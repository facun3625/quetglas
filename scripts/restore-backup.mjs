#!/usr/bin/env node
// Restaura una copia de seguridad (la de Configuración → Copias de seguridad) en una base de datos.
//
//   node scripts/restore-backup.mjs <archivo> --url "postgresql://usuario:clave@localhost:PUERTO/base"          (solo mira)
//   node scripts/restore-backup.mjs <archivo> --url "postgresql://..." --yes                                    (restaura)
//
// <archivo> puede ser el .json.gz descargado del panel o un .cpbk cifrado (con BACKUP_SECRET en el entorno).
// La base de destino tiene que tener ya las tablas (corré `npx prisma migrate deploy` apuntando a ella).
// OJO: VACÍA las tablas de destino y las reemplaza por las de la copia. Por eso la URL es obligatoria
// y se muestra a qué base apunta: nunca se toma de DATABASE_URL, para no pisar la base equivocada.

import { createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import pg from "pg";

const MAGIC = Buffer.from("CPBK1\n");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--url");
const urlIdx = args.indexOf("--url");
const url = urlIdx >= 0 ? args[urlIdx + 1] : null;
const yes = args.includes("--yes");

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!file || !url) fail('Uso: node scripts/restore-backup.mjs <archivo> --url "postgresql://usuario:clave@host:puerto/base" [--yes]');

let raw = readFileSync(file);
if (raw.subarray(0, MAGIC.length).equals(MAGIC)) {
  const secret = process.env.BACKUP_SECRET;
  if (!secret) fail("La copia está cifrada: corré el comando con BACKUP_SECRET=... delante.");
  let o = MAGIC.length;
  const salt = raw.subarray(o, (o += 16));
  const iv = raw.subarray(o, (o += 12));
  const tag = raw.subarray(o, (o += 16));
  const d = createDecipheriv("aes-256-gcm", scryptSync(secret, salt, 32), iv);
  d.setAuthTag(tag);
  try {
    raw = Buffer.concat([d.update(raw.subarray(o)), d.final()]);
  } catch {
    fail("No se pudo descifrar: el BACKUP_SECRET no es el de esta copia, o el archivo está dañado.");
  }
}
let backup;
try {
  backup = JSON.parse(gunzipSync(raw).toString("utf8"));
} catch {
  fail("El archivo no es una copia válida (.json.gz).");
}
if (backup.format !== "cortopassi-backup" || !backup.tables) fail("El archivo no parece una copia de Cortopassi.");

const names = Object.keys(backup.tables);
const total = names.reduce((n, t) => n + backup.tables[t].length, 0);
const target = new URL(url.replace(/^postgres(ql)?:/, "http:"));
console.log(`Copia del ${backup.createdAt}: ${names.length} tablas, ${total} filas.`);
console.log(`Base de destino: ${target.hostname}:${target.port || 5432}${target.pathname}`);

const client = new pg.Client({ connectionString: url.replace(/\?.*$/, "") });
await client.connect();
try {
  const have = new Set((await client.query(`select table_name from information_schema.tables where table_schema = 'public'`)).rows.map((r) => r.table_name));
  const missing = names.filter((t) => !have.has(t));
  if (missing.length) fail(`La base de destino no tiene estas tablas: ${missing.join(", ")}.\nCorré primero las migraciones en esa base: DATABASE_URL="..." npx prisma migrate deploy`);

  const applied = new Set((await client.query(`select migration_name from _prisma_migrations where finished_at is not null`).catch(() => ({ rows: [] }))).rows.map((r) => r.migration_name));
  const newer = [...applied].filter((m) => !(backup.migrations ?? []).includes(m));
  if (newer.length) console.log(`Aviso: la base de destino tiene ${newer.length} migración(es) más nuevas que la copia; las columnas nuevas quedarán vacías.`);

  const filled = [];
  for (const t of names) {
    const n = Number((await client.query(`select count(*) from "${t}"`)).rows[0].count);
    if (n > 0) filled.push([t, n]);
  }
  if (filled.length) console.log(`La base de destino NO está vacía (${filled.length} tablas con datos): se van a reemplazar.`);

  if (!yes) {
    console.log("\nNo se cambió nada. Para restaurar de verdad, repetí el comando agregando --yes");
    process.exit(0);
  }

  await client.query("begin");
  await client.query("set session_replication_role = replica"); // sin chequear claves foráneas durante la carga
  await client.query(`truncate ${names.map((t) => `"${t}"`).join(", ")} restart identity cascade`);
  for (const t of names) {
    const rows = backup.tables[t];
    for (let i = 0; i < rows.length; i += 200) {
      await client.query(`insert into "${t}" select * from json_populate_recordset(null::"${t}", $1::json)`, [JSON.stringify(rows.slice(i, i + 200))]);
    }
    if (rows.length) console.log(`  ${t}: ${rows.length}`);
  }
  // Los contadores automáticos (número de pedido) siguen desde el mayor valor cargado
  const seqs = await client.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' and column_default like 'nextval%'`);
  for (const { table_name, column_name } of seqs.rows) {
    if (!names.includes(table_name)) continue;
    await client.query(
      `select setval(pg_get_serial_sequence('"${table_name}"', '${column_name}'), greatest(coalesce((select max("${column_name}") from "${table_name}"), 0), 1), (select count(*) > 0 from "${table_name}"))`
    );
  }
  await client.query("commit");
  console.log("\n✅ Restauración lista.");
} catch (err) {
  await client.query("rollback").catch(() => {});
  fail(`Falló y no se cambió nada (se deshizo todo): ${err.message}`);
} finally {
  await client.end();
}
