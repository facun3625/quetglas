import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { validateR2Fields, testR2Connection } = loader({ '@/lib/storage': { r2Client: () => null } })('@/lib/r2Test');
const CFG = { accountId: 'a'.repeat(32), accessKeyId: 'AK', secretAccessKey: 'SK', bucket: 'tienda-imagenes', publicUrl: 'https://img.tudominio.com' };

test('R2: validación de los datos cargados', () => {
  assert.equal(validateR2Fields(CFG), null);
  assert.match(validateR2Fields({ ...CFG, accountId: 'corto' }), /Account ID/);
  assert.match(validateR2Fields({ ...CFG, accessKeyId: ' ' }), /Access Key/);
  assert.match(validateR2Fields({ ...CFG, secretAccessKey: '' }), /Secret/);
  assert.match(validateR2Fields({ ...CFG, bucket: 'Mi Bucket!' }), /bucket/);
  for (const bad of ['http://x.com', 'img.tudominio.com', 'https://', 'javascript:alert(1)']) assert.match(validateR2Fields({ ...CFG, publicUrl: bad }), /URL pública/);
});

function fakeClient({ failWith } = {}) {
  const sent = [];
  return { sent, send: async (cmd) => { sent.push(cmd.constructor.name); if (failWith && cmd.constructor.name === 'PutObjectCommand') { const e = new Error('x'); e.name = failWith; throw e; } return {}; } };
}

test('R2: prueba de conexión sube, lee por la URL pública y borra', async () => {
  const client = fakeClient();
  let url;
  const ok = await testR2Connection(CFG, { client, fetchImpl: async (u) => { url = u; return { ok: true, text: async () => 'prueba 2026' }; } });
  assert.equal(ok.ok, true); assert.deepEqual(client.sent, ['PutObjectCommand', 'DeleteObjectCommand']); assert.match(url, /^https:\/\/img\.tudominio\.com\/_prueba\//);
});

test('R2: errores claros (claves, bucket, URL pública que no muestra el archivo)', async () => {
  assert.match((await testR2Connection(CFG, { client: fakeClient({ failWith: 'InvalidAccessKeyId' }) })).message, /rechazó las claves/);
  assert.match((await testR2Connection(CFG, { client: fakeClient({ failWith: 'NoSuchBucket' }) })).message, /bucket/);
  const hidden = await testR2Connection(CFG, { client: fakeClient(), fetchImpl: async () => ({ ok: false, text: async () => '' }) });
  assert.equal(hidden.ok, false); assert.match(hidden.message, /URL pública/);
  const down = await testR2Connection(CFG, { client: fakeClient(), fetchImpl: async () => { throw new Error('net'); } });
  assert.equal(down.ok, false);
  assert.equal((await testR2Connection({ ...CFG, accountId: 'x' }, { client: fakeClient() })).ok, false);
});
