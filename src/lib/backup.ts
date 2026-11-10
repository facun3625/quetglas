import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getR2Config, r2Client } from "@/lib/storage";
import { decryptBackup, encryptBackup } from "@/lib/backupCrypto";

// Copias de seguridad de la base de datos, hechas por la propia app (no necesita pg_dump ni Docker).
// Cada copia es un JSON con todas las tablas, comprimido y cifrado. Se guarda en R2 (fuera del
// servidor) o, si R2 no está configurado, en la carpeta /backups del servidor (fuera de /public).
// Se restauran con scripts/restore-backup.mjs.

export const KEEP_BACKUPS = 14;
const PREFIX = "backups/";
// Sin R2 las copias van a /backups (fuera de /public); BACKUP_LOCAL_DIR permite elegir otra carpeta.
const localDir = () => process.env.BACKUP_LOCAL_DIR || path.join(process.cwd(), "backups");
const NAME_RE = /^backup-\d{8}-\d{6}-(manual|auto)\.cpbk$/;

export type BackupKind = "manual" | "auto";
export type BackupFile = { name: string; size: number; modified: Date; kind: BackupKind };

export function isValidBackupName(name: string): boolean {
  return NAME_RE.test(name);
}

export function backupSecret(): string | null {
  const s = process.env.BACKUP_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export function backupFileName(kind: BackupKind, now = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const d = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}`;
  const t = `${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `backup-${d}-${t}-${kind}.cpbk`;
}

const quote = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

// JSON comprimido con todas las tablas. Se lee todo en una sola transacción (snapshot consistente).
export async function dumpDatabase(): Promise<Buffer> {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations'
    order by table_name`;
  const migrations = await prisma
    .$queryRaw<{ migration_name: string }[]>`select migration_name from _prisma_migrations where finished_at is not null order by migration_name`
    .catch(() => []);

  const parts: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      for (const t of tables) {
        const rows = await tx.$queryRawUnsafe<{ d: string }[]>(`select coalesce(json_agg(t), '[]'::json)::text as d from ${quote(t.table_name)} t`);
        parts.push(`${JSON.stringify(t.table_name)}:${rows[0].d}`);
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 600_000, maxWait: 10_000 }
  );

  const json = `{"format":"cortopassi-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())},"migrations":${JSON.stringify(
    migrations.map((m) => m.migration_name)
  )},"tables":{${parts.join(",")}}}`;
  return promisify(gzip)(Buffer.from(json));
}

// ---------- Almacenamiento ----------
async function putFile(name: string, body: Buffer): Promise<"r2" | "disco"> {
  const cfg = await getR2Config();
  if (cfg) {
    await r2Client(cfg).send(new PutObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + name, Body: body, ContentType: "application/octet-stream", CacheControl: "no-store" }));
    return "r2";
  }
  await mkdir(localDir(), { recursive: true });
  await writeFile(path.join(localDir(), name), body);
  return "disco";
}

export async function listBackups(): Promise<BackupFile[]> {
  const out: BackupFile[] = [];
  const cfg = await getR2Config();
  if (cfg) {
    let token: string | undefined;
    do {
      const res = await r2Client(cfg).send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: PREFIX, ContinuationToken: token }));
      for (const o of res.Contents ?? []) {
        const name = o.Key?.slice(PREFIX.length) ?? "";
        if (isValidBackupName(name)) out.push({ name, size: o.Size ?? 0, modified: o.LastModified ?? new Date(0), kind: name.includes("-auto.") ? "auto" : "manual" });
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
  } else {
    const names = await readdir(localDir()).catch(() => [] as string[]);
    for (const name of names.filter(isValidBackupName)) {
      const st = await stat(path.join(localDir(), name));
      out.push({ name, size: st.size, modified: st.mtime, kind: name.includes("-auto.") ? "auto" : "manual" });
    }
  }
  return out.sort((a, b) => b.name.localeCompare(a.name));
}

async function getFile(name: string): Promise<Buffer> {
  const cfg = await getR2Config();
  if (cfg) {
    const res = await r2Client(cfg).send(new GetObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + name }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return readFile(path.join(localDir(), name));
}

export async function deleteBackup(name: string): Promise<void> {
  if (!isValidBackupName(name)) throw new Error("Nombre de copia inválido");
  const cfg = await getR2Config();
  if (cfg) await r2Client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + name }));
  else await rm(path.join(localDir(), name), { force: true });
}

// Copia descifrada (.json.gz) lista para descargar o para restaurar.
export async function readBackupPlain(name: string): Promise<Buffer> {
  if (!isValidBackupName(name)) throw new Error("Nombre de copia inválido");
  const secret = backupSecret();
  if (!secret) throw new Error("Falta BACKUP_SECRET en el servidor");
  return decryptBackup(await getFile(name), secret);
}

export async function pruneBackups(keep = KEEP_BACKUPS): Promise<number> {
  const all = await listBackups();
  const old = all.slice(keep);
  for (const f of old) await deleteBackup(f.name).catch(() => undefined);
  return old.length;
}

export async function createBackup(kind: BackupKind): Promise<{ name: string; size: number; where: "r2" | "disco" }> {
  const secret = backupSecret();
  if (!secret) throw new Error("Falta BACKUP_SECRET en el servidor (mínimo 16 caracteres)");
  const plain = await dumpDatabase();
  // Antes de guardar se comprueba que la copia se pueda leer y volver a abrir: una copia
  // que no se puede restaurar es peor que ninguna, porque da una falsa seguridad.
  const parsed = JSON.parse((await promisify(gunzip)(plain)).toString("utf8")) as { tables?: Record<string, unknown[]> };
  if (!parsed.tables || Object.keys(parsed.tables).length === 0) throw new Error("La copia salió vacía");
  const enc = encryptBackup(plain, secret);
  if (!decryptBackup(enc, secret).equals(plain)) throw new Error("La copia cifrada no coincide con la original");
  const name = backupFileName(kind);
  const where = await putFile(name, enc);
  await pruneBackups();
  return { name, size: enc.length, where };
}
