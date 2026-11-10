import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loader(stubs = {}) {
  const cache = new Map();
  function load(name) {
    if (name in stubs) return stubs[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const source = readFileSync(`src/${name.slice(2)}.ts`, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    cache.set(name, mod);
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`)(load, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

function fixture(options = {}) {
  const tokens = [];
  const sent = [];
  const users = [{ id: 'u1', email: 'ana@example.com', name: 'Ana Pérez', passwordHash: null }];
  const prisma = {
    user: {
      findUnique: async ({ where }) => users.find((u) => u.email === where.email) ?? null,
      findFirst: async ({ where }) => users.find((u) => u.email.toLowerCase() === where.email.equals.toLowerCase()) ?? null,
      update: async ({ where, data }) => Object.assign(users.find((u) => u.id === where.id), data),
    },
    passwordResetToken: {
      create: async ({ data }) => { tokens.push({ id: `t${tokens.length}`, usedAt: null, createdAt: new Date(), ...data }); },
      findFirst: async ({ where }) => tokens.find((t) => t.userId === where.userId && t.createdAt > where.createdAt.gt) ?? null,
      findUnique: async ({ where }) => tokens.find((t) => t.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({ where, data }) => {
        const t = tokens.find((x) => x.id === where.id && x.usedAt === where.usedAt);
        if (!t) return { count: 0 };
        Object.assign(t, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }) => { for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].userId === where.userId && tokens[i].id !== where.id.not) tokens.splice(i, 1); },
    },
    $transaction: async (ops) => Promise.all(ops),
  };
  const load = loader({
    '@/lib/prisma': { prisma },
    '@/lib/mailer': { getMailSender: async () => (options.noMail ? null : { send: async (to, subject, html) => { sent.push({ to, subject, html }); return { ok: true }; } }) },
    '@/lib/settings': { getStoreSettingsRow: async () => ({ franchiseName: 'Cortopassi - Tienda' }) },
    '@/lib/mailTemplate': { buildMailHtml: (d) => `${d.title}\n${d.body}` },
  });
  process.env.NEXTAUTH_URL = 'https://tienda.example.com';
  return { lib: load('@/lib/passwordReset'), tokens, sent, users };
}
const tokenFromMail = (mail) => decodeURIComponent(mail.html.match(/token=([^\s]+)/)[1]);

test('forgot password: unknown email sends nothing and reveals nothing', async () => {
  const f = fixture();
  await f.lib.requestPasswordReset('nadie@example.com');
  assert.equal(f.sent.length, 0);
  assert.equal(f.tokens.length, 0);
});

test('forgot password: emails a one-time link and stores only the token hash', async () => {
  const f = fixture();
  await f.lib.requestPasswordReset('ANA@example.com');
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to, 'ana@example.com');
  const token = tokenFromMail(f.sent[0]);
  assert.ok(f.sent[0].html.includes('https://tienda.example.com/recuperar?token='));
  assert.equal(f.tokens[0].tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(f.tokens).includes(token), 'el token en claro no se guarda');
  // anti-spam: un segundo pedido inmediato no manda otro mail
  await f.lib.requestPasswordReset('ana@example.com');
  assert.equal(f.sent.length, 1);
});

test('reset sets the password, token is single-use and old tokens are revoked', async () => {
  const f = fixture();
  await f.lib.requestPasswordReset('ana@example.com');
  const token = tokenFromMail(f.sent[0]);
  assert.deepEqual(await f.lib.resetPasswordWithToken(token, 'corta'), { ok: false, error: 'La contraseña debe tener al menos 8 caracteres' });
  assert.deepEqual(await f.lib.resetPasswordWithToken(token, 'unaClaveSegura1'), { ok: true });
  assert.ok(require('bcryptjs').compareSync('unaClaveSegura1', f.users[0].passwordHash));
  const again = await f.lib.resetPasswordWithToken(token, 'otraClaveSegura2');
  assert.equal(again.ok, false);
  assert.ok(require('bcryptjs').compareSync('unaClaveSegura1', f.users[0].passwordHash), 'no se pisa con un token usado');
});

test('invalid and expired tokens are rejected', async () => {
  const f = fixture();
  assert.equal((await f.lib.resetPasswordWithToken('inventado', 'unaClaveSegura1')).ok, false);
  const token = await f.lib.createResetToken('u1', -1000); // ya vencido
  assert.equal((await f.lib.resetPasswordWithToken(token, 'unaClaveSegura1')).ok, false);
  assert.equal(f.users[0].passwordHash, null);
});

test('activation mail for migrated customers uses a 7-day token', async () => {
  const f = fixture();
  assert.equal(await f.lib.sendResetEmail(f.users[0], 'activation'), true);
  assert.match(f.sent[0].subject, /Activá tu cuenta/);
  const ttl = f.tokens[0].expiresAt.getTime() - Date.now();
  assert.ok(ttl > 6.9 * 24 * 3600 * 1000 && ttl <= 7 * 24 * 3600 * 1000);
});

test('no mail provider configured: reports failure instead of crashing', async () => {
  const f = fixture({ noMail: true });
  assert.equal(await f.lib.sendResetEmail(f.users[0], 'reset'), false);
});
