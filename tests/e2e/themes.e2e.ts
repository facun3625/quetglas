import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import * as t from '@/app/admin/(dashboard)/temas/actions';
import { DEFAULT_THEME_CONFIG, pickActiveTheme, sanitizeThemeConfig, themeStatus } from '@/lib/themes';

async function createBlank(name: string): Promise<string> {
  const result = await t.saveTheme({ name, description: '', startsAt: '', endsAt: '', config: DEFAULT_THEME_CONFIG }, false);
  assert.equal(result.ok, true);
  return (result as { ok: true; id: string }).id;
}

async function main() {
  await prisma.theme.deleteMany();
  const id = await createBlank('Navidad');
  const row = await prisma.theme.findUniqueOrThrow({ where: { id } });
  assert.equal(row.name, 'Navidad'); assert.equal(row.enabled, false);
  console.log('creado sin guardar en el servidor hasta Guardar OK, enabled=', row.enabled);
  await t.activateTheme(id);
  const all = await prisma.theme.findMany({ where: { enabled: true } });
  assert.equal(pickActiveTheme(all)?.id, id);
  await t.deactivateTheme(id);
  assert.equal(pickActiveTheme(await prisma.theme.findMany({ where: { enabled: true } })), null);
  // Guardar y activar: sin fechas queda vigente ya; con fin pasado se rechaza; con inicio futuro queda programado
  const input = { id, name: 'Navidad', description: '', startsAt: '', endsAt: '', config: row.config as never };
  assert.equal((await t.saveTheme(input, true)).ok, true);
  let cur = await prisma.theme.findUniqueOrThrow({ where: { id } });
  assert.equal(cur.enabled, true); assert.ok(cur.startsAt);
  assert.equal(themeStatus(cur, id), 'live');
  assert.equal((await t.saveTheme({ ...input, endsAt: new Date(Date.now() - 3600_000).toISOString() }, true)).ok, false);
  const future = new Date(Date.now() + 86400_000).toISOString();
  const end = new Date(Date.now() + 2 * 86400_000).toISOString();
  assert.equal((await t.saveTheme({ ...input, startsAt: future, endsAt: end }, true)).ok, true);
  cur = await prisma.theme.findUniqueOrThrow({ where: { id } });
  assert.equal(themeStatus(cur, null), 'scheduled');
  assert.equal(pickActiveTheme([cur]), null, 'programado en el futuro no se muestra todavía');
  // vencido: Reactivar (activateTheme) saca el fin pasado y lo deja vigente
  await prisma.theme.update({ where: { id }, data: { startsAt: new Date(Date.now() - 2 * 86400_000), endsAt: new Date(Date.now() - 86400_000) } });
  cur = await prisma.theme.findUniqueOrThrow({ where: { id } });
  assert.equal(themeStatus(cur, null), 'expired');
  await t.activateTheme(id);
  cur = await prisma.theme.findUniqueOrThrow({ where: { id } });
  assert.equal(themeStatus(cur, id), 'live');
  assert.equal(cur.endsAt, null);
  // "Solo guardar" no cambia el estado
  await t.saveTheme({ ...input, name: 'Navidad 2026' }, false);
  assert.equal((await prisma.theme.findUniqueOrThrow({ where: { id } })).enabled, true);
  // Aspecto base: se crea una sola vez, no tiene fechas, no se activa/apaga/borra y no cuenta como campaña
  const b1 = await t.openBaseTheme(); const b2 = await t.openBaseTheme();
  assert.equal(b1.id, b2.id); assert.equal(await prisma.theme.count({ where: { isBase: true } }), 1);
  const baseRow = await prisma.theme.findUniqueOrThrow({ where: { id: b1.id } });
  const cfg = { ...(baseRow.config as object), colors: { ...(baseRow.config as { colors: object }).colors, primary: '#123456' } } as never;
  assert.equal((await t.saveTheme({ id: b1.id, name: 'x', description: '', startsAt: new Date(Date.now() + 86400_000).toISOString(), endsAt: '', config: cfg }, true)).ok, true);
  let base = await prisma.theme.findUniqueOrThrow({ where: { id: b1.id } });
  assert.equal(base.startsAt, null); assert.equal(base.enabled, true); assert.equal((base.config as { colors: { primary: string } }).colors.primary, '#123456');
  await t.deactivateTheme(b1.id); await t.deleteTheme(b1.id).catch(() => {});
  assert.equal(await prisma.theme.count({ where: { isBase: true } }), 1, 'el base no se apaga ni se borra');
  base = await prisma.theme.findUniqueOrThrow({ where: { id: b1.id } }); assert.equal(base.enabled, true);
  await t.resetBaseTheme(b1.id);
  base = await prisma.theme.findUniqueOrThrow({ where: { id: b1.id } });
  assert.notEqual((base.config as { colors: { primary: string } }).colors.primary, '#123456');
  // un solo aspecto a la vez: activar una campaña apaga la que se veía; "activar el base" las apaga a todas
  await prisma.theme.deleteMany({ where: { isBase: false } });
  const navId = await createBlank('Tema nuevo'); const bfId = await createBlank('Tema nuevo');
  const prog = await prisma.theme.create({ data: { name: 'Futura', enabled: true, startsAt: new Date(Date.now() + 5 * 86400_000), config: {} } });
  await t.activateTheme(navId);
  await t.activateTheme(bfId);
  assert.equal((await prisma.theme.findUniqueOrThrow({ where: { id: navId } })).enabled, false, 'activar una campaña apaga la anterior');
  assert.equal((await prisma.theme.findUniqueOrThrow({ where: { id: bfId } })).enabled, true);
  await t.activateTheme(navId);
  assert.equal((await prisma.theme.findUniqueOrThrow({ where: { id: bfId } })).enabled, false);
  await t.activateBaseTheme();
  assert.equal(await prisma.theme.count({ where: { isBase: false, enabled: true, startsAt: { lte: new Date() } } }), 0, 'el base apaga las campañas visibles');
  assert.equal((await prisma.theme.findUniqueOrThrow({ where: { id: prog.id } })).enabled, true, 'las programadas a futuro no se tocan');
  const rest = await prisma.theme.findMany({ where: { isBase: false } });
  assert.equal(pickActiveTheme(rest), null, 'sin campañas vigentes se ve el aspecto base');
  // Portadas de categoría por campaña: solo entradas con id válido y url segura sobreviven el saneo
  const sanitized = sanitizeThemeConfig({ ...DEFAULT_THEME_CONFIG, categoryImages: { ok1: '/img/a.jpg', 'bad id': '/img/b.jpg', ok2: 'javascript:alert(1)' } });
  assert.deepEqual(sanitized.categoryImages, { ok1: '/img/a.jpg' });
  console.log('themes e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
