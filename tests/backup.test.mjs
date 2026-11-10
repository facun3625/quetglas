import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const work = mkdtempSync(path.join(tmpdir(), 'backup-test-'));
process.env.BACKUP_LOCAL_DIR = path.join(work, 'backups');
const prismaStub = {
  prisma: {
    $queryRaw: async (strings) => (String(strings[0]).includes('select migration_name') ? [{ migration_name: '2026_init' }] : [{ table_name: 'Product' }, { table_name: 'User' }]),
    $transaction: async (fn) => fn({ $queryRawUnsafe: async (sql) => [{ d: sql.includes('"User"') ? '[{"id":"u1","name":"Ñandú \\"x\\""}]' : '[{"id":"p1"},{"id":"p2"}]' }] }),
  },
};
const stubs = { '@/lib/prisma': prismaStub, '@/lib/storage': { getR2Config: async () => null, r2Client: () => null }, '@/generated/prisma/client': { Prisma: { TransactionIsolationLevel: { RepeatableRead: 'RepeatableRead' } } } };
const load = loader(stubs);
const crypto = load('@/lib/backupCrypto');
const backup = load('@/lib/backup');

test('cifrado: ida y vuelta, secreto equivocado y archivo alterado', () => {
  const plain = Buffer.from('datos de clientes ñ');
  const enc = crypto.encryptBackup(plain, 'un-secreto-de-prueba-123');
  assert.ok(crypto.isEncryptedBackup(enc));
  assert.ok(!enc.includes(plain), 'el contenido no debe verse en claro');
  assert.deepEqual(crypto.decryptBackup(enc, 'un-secreto-de-prueba-123'), plain);
  assert.throws(() => crypto.decryptBackup(enc, 'otro-secreto-de-prueba-123'), /BACKUP_SECRET/);
  const tampered = Buffer.from(enc);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => crypto.decryptBackup(tampered, 'un-secreto-de-prueba-123'));
  assert.throws(() => crypto.decryptBackup(Buffer.from('no es una copia'), 'x'.repeat(20)), /no es una copia/i);
});

test('nombres de copia: formato y validación (sin rutas)', () => {
  const n = backup.backupFileName('manual', new Date('2026-10-05T13:04:09Z'));
  assert.equal(n, 'backup-20261005-130409-manual.cpbk');
  assert.ok(backup.isValidBackupName(n));
  for (const bad of ['../.env', 'backup-20261005-130409-otro.cpbk', 'backup.cpbk', '/etc/passwd', 'backup-20261005-130409-auto.cpbk/../x', '']) assert.ok(!backup.isValidBackupName(bad), bad);
});

test('BACKUP_SECRET: se exige un mínimo de 16 caracteres', () => {
  delete process.env.BACKUP_SECRET;
  assert.equal(backup.backupSecret(), null);
  process.env.BACKUP_SECRET = 'corto';
  assert.equal(backup.backupSecret(), null);
  process.env.BACKUP_SECRET = 'x'.repeat(16);
  assert.equal(backup.backupSecret(), 'x'.repeat(16));
});

test('crear copia: contenido, cifrado en disco, descarga descifrada y rotación', async () => {
  delete process.env.BACKUP_SECRET;
  await assert.rejects(() => backup.createBackup('manual'), /BACKUP_SECRET/);

  process.env.BACKUP_SECRET = 'secreto-de-prueba-para-backups';
  const r = await backup.createBackup('manual');
  assert.equal(r.where, 'disco');
  assert.ok(existsSync(path.join(work, 'backups', r.name)));

  const plain = await backup.readBackupPlain(r.name);
  const data = JSON.parse(gunzipSync(plain).toString('utf8'));
  assert.equal(data.format, 'cortopassi-backup');
  assert.deepEqual(data.migrations, ['2026_init']);
  assert.deepEqual(Object.keys(data.tables), ['Product', 'User']);
  assert.equal(data.tables.Product.length, 2);
  assert.equal(data.tables.User[0].name, 'Ñandú "x"');

  // 16 copias más viejas: queda solo KEEP_BACKUPS (las más nuevas)
  for (let i = 1; i <= 16; i++) writeFileSync(path.join(work, 'backups', `backup-2026010${i < 10 ? i : 9}-0000${String(i).padStart(2, '0')}-auto.cpbk`), 'x');
  await backup.pruneBackups();
  const left = readdirSync(path.join(work, 'backups'));
  assert.equal(left.length, backup.KEEP_BACKUPS);
  assert.ok(left.includes(r.name), 'la más nueva se conserva');

  await backup.deleteBackup(r.name);
  assert.ok(!existsSync(path.join(work, 'backups', r.name)));
  await assert.rejects(() => backup.deleteBackup('../../x'), /inválido/);
});
