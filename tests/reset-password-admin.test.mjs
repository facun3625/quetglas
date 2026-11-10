import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import { loader } from './helpers/loader.mjs';

const users = { u1: { id: 'u1', email: 'cli@example.com', name: 'Cli', role: 'customer', passwordHash: 'viejo' }, sa: { id: 'sa', email: 'super@example.com', name: 'S', role: 'superadmin', passwordHash: 'x' } };
const tokens = { u1: 2 };
const logs = [];
let role = 'superadmin';
let mailOk = true;
const sent = [];

const stubs = {
  'next/cache': { revalidatePath: () => {} },
  '@/lib/adminAuth': {
    requireAdmin: async () => ({ user: { id: 'adm' } }),
    requireSuperAdmin: async () => { if (role !== 'superadmin') throw new Error('No autorizado'); return { user: { id: 'sa' } }; },
  },
  '@/lib/adminLog': { logAdminAction: async (action, opts) => logs.push({ action, ...opts }) },
  '@/lib/passwordReset': { sendResetEmail: async (u, kind) => { sent.push({ u, kind }); return mailOk; } },
  '@/lib/prisma': {
    prisma: {
      user: { findUnique: async ({ where }) => users[where.id] ?? null, update: ({ where, data }) => { Object.assign(users[where.id], data); return Promise.resolve(); } },
      passwordResetToken: { deleteMany: ({ where }) => { tokens[where.userId] = 0; return Promise.resolve(); } },
      $transaction: async (ops) => Promise.all(ops),
    },
  },
};
const { setUserPassword, sendUserResetLink } = loader(stubs)('@/app/admin/(dashboard)/usuarios/actions');

test('restablecer contraseña: solo el superadmin', async () => {
  role = 'admin';
  await assert.rejects(() => setUserPassword('u1', 'nueva-clave-123'), /No autorizado/);
  await assert.rejects(() => sendUserResetLink('u1'), /No autorizado/);
  assert.equal(users.u1.passwordHash, 'viejo');
  role = 'superadmin';
});

test('restablecer contraseña: valida, guarda el hash, anula links viejos y no registra la clave', async () => {
  assert.equal((await setUserPassword('u1', 'corta')).ok, false);
  assert.equal((await setUserPassword('u1', 'x'.repeat(201))).ok, false);
  assert.equal((await setUserPassword('nadie', 'nueva-clave-123')).ok, false);
  assert.equal((await setUserPassword('sa', 'nueva-clave-123')).ok, false, 'la cuenta del superadmin no se toca');
  assert.equal(users.sa.passwordHash, 'x');

  const r = await setUserPassword('u1', 'nueva-clave-123');
  assert.equal(r.ok, true);
  assert.ok(await bcrypt.compare('nueva-clave-123', users.u1.passwordHash));
  assert.notEqual(users.u1.passwordHash, 'nueva-clave-123');
  assert.equal(tokens.u1, 0);
  const log = logs.find((l) => l.action === 'user.reset_password');
  assert.ok(log && log.targetId === 'u1');
  assert.ok(!JSON.stringify(logs).includes('nueva-clave-123'), 'la contraseña no debe quedar en el registro');
});

test('restablecer contraseña: link por mail, con y sin correo configurado', async () => {
  mailOk = false;
  const bad = await sendUserResetLink('u1');
  assert.equal(bad.ok, false);
  assert.match(bad.message, /correo/i);
  mailOk = true;
  const ok = await sendUserResetLink('u1');
  assert.equal(ok.ok, true);
  assert.equal(sent.at(-1).kind, 'reset');
  assert.equal((await sendUserResetLink('sa')).ok, false);
});
