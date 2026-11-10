import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { updateR2Settings } from '@/app/admin/(dashboard)/configuracion/actions';
import { getR2Config, invalidateR2Cache } from '@/lib/storage';

const ok = { r2AccountId: 'a'.repeat(32), r2Bucket: 'tienda', r2PublicUrl: 'https://img.x.com/', r2AccessKeyId: 'AK1', r2SecretAccessKey: 'SECRET1' };
async function main() {
  await prisma.storeSettings.deleteMany(); invalidateR2Cache();
  delete process.env.R2_ACCOUNT_ID;
  assert.equal(await getR2Config(), null, 'sin nada: disco local');

  assert.equal((await updateR2Settings({ ...ok, r2AccountId: 'corto' })).ok, false, 'datos inválidos no se guardan');
  assert.equal(await getR2Config(), null);

  assert.equal((await updateR2Settings(ok)).ok, true);
  let cfg = await getR2Config();
  assert.equal(cfg?.source, 'panel'); assert.equal(cfg?.publicUrl, 'https://img.x.com'); assert.equal(cfg?.secretAccessKey, 'SECRET1');

  // claves en blanco no se borran
  assert.equal((await updateR2Settings({ ...ok, r2AccessKeyId: '', r2SecretAccessKey: '', r2Bucket: 'otro' })).ok, true);
  cfg = await getR2Config(); assert.equal(cfg?.bucket, 'otro'); assert.equal(cfg?.accessKeyId, 'AK1'); assert.equal(cfg?.secretAccessKey, 'SECRET1');

  // el panel tiene prioridad sobre el entorno; sin panel, entra el entorno
  process.env.R2_ACCOUNT_ID = 'b'.repeat(32); process.env.R2_ACCESS_KEY_ID = 'E'; process.env.R2_SECRET_ACCESS_KEY = 'E'; process.env.R2_BUCKET = 'env'; process.env.R2_PUBLIC_URL = 'https://env.x.com';
  invalidateR2Cache(); assert.equal((await getR2Config())?.source, 'panel');
  await updateR2Settings({ r2Clear: 'on' }); invalidateR2Cache();
  cfg = await getR2Config(); assert.equal(cfg?.source, 'entorno'); assert.equal(cfg?.bucket, 'env');
  const row = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 'global' } });
  assert.equal(row.r2SecretAccessKey, null);
  console.log('r2 settings e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
