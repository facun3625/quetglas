import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

// ---- Mes de consumo (hora de Argentina, UTC-3)
const { monthKey, nextResetDate, startOfMonth } = loader()('@/lib/monthKey');

test('consumo: el mes cambia a medianoche de Argentina, no a medianoche UTC', () => {
  // 1 de noviembre 01:30 UTC = 31 de octubre 22:30 en Argentina: todavía es octubre
  assert.equal(monthKey(new Date('2026-11-01T01:30:00Z')), '2026-10');
  // 1 de noviembre 03:00 UTC = 00:00 en Argentina: ya es noviembre
  assert.equal(monthKey(new Date('2026-11-01T03:00:00Z')), '2026-11');
  assert.equal(monthKey(new Date('2026-12-31T23:59:00Z')), '2026-12');
  assert.equal(monthKey(new Date('2027-01-01T02:59:00Z')), '2026-12');
  assert.equal(nextResetDate(new Date('2026-10-15T12:00:00Z')).toISOString(), '2026-11-01T03:00:00.000Z');
  assert.equal(nextResetDate(new Date('2026-12-20T12:00:00Z')).toISOString(), '2027-01-01T03:00:00.000Z');
  assert.equal(startOfMonth(new Date('2026-10-15T12:00:00Z')).toISOString(), '2026-10-01T03:00:00.000Z');
});

// ---- Cálculo del cupo
const usage = loader({ '@/lib/prisma': { prisma: {} }, '@/lib/settings': { getStoreSettingsRow: async () => ({}) } })('@/lib/usage');

test('consumo: usado, restante, porcentaje y avisos', () => {
  const l = usage.usageLine(0, 1000);
  assert.deepEqual([l.remaining, l.pct, l.warning, l.exhausted], [1000, 0, false, false]);
  const w = usage.usageLine(800, 1000);
  assert.deepEqual([w.remaining, w.pct, w.warning, w.exhausted], [200, 80, true, false], 'a partir del 80% avisa');
  assert.equal(usage.usageLine(799, 1000).warning, false);
  const e = usage.usageLine(1000, 1000);
  assert.deepEqual([e.remaining, e.exhausted], [0, true], 'justo en el tope ya está agotado');
  const over = usage.usageLine(1300, 1000);
  assert.deepEqual([over.remaining, over.pct, over.exhausted], [0, 100, true], 'los mails de compra pueden pasarse del cupo');
  // Sin cupo cargado (o en 0): sin límite, nunca se frena
  for (const q of [null, 0]) {
    const n = usage.usageLine(99999, q);
    assert.deepEqual([n.quota, n.remaining, n.exhausted, n.warning, n.pct], [null, null, false, false, 0]);
  }
});

// ---- Cada mail que sale suma al contador (y uno que falla, no)
function mailerWith(counter, ok) {
  const settings = { mailFromEmail: 'tienda@example.com', mailFromName: 'Tienda', franchiseName: 'Tienda', mailProvider: 'resend', resendApiKey: 're_test' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok, status: ok ? 200 : 500, text: async () => 'error' });
  const { getMailSender } = loader({
    '@/lib/settings': { getStoreSettingsRow: async () => settings },
    '@/lib/usage': { addUsage: async (kind, n) => { counter.push([kind, n]); } },
  })('@/lib/mailer');
  return { getMailSender, restore: () => { globalThis.fetch = realFetch; } };
}

test('mails: cada envío exitoso resta 1 del cupo y un fallo no resta nada', async () => {
  const counted = [];
  const good = mailerWith(counted, true);
  try {
    const sender = await good.getMailSender();
    assert.equal((await sender.send('a@example.com', 'Hola', '<p>x</p>')).ok, true);
    assert.equal((await sender.send('b@example.com', 'Hola', '<p>x</p>')).ok, true);
  } finally { good.restore(); }
  assert.deepEqual(counted, [['mail', 1], ['mail', 1]]);

  const failed = [];
  const bad = mailerWith(failed, false);
  try {
    const sender = await bad.getMailSender();
    assert.equal((await sender.send('c@example.com', 'Hola', '<p>x</p>')).ok, false);
  } finally { bad.restore(); }
  assert.deepEqual(failed, [], 'un mail que no salió no consume cupo');
});

test('mails: si falla el contador, el mail igual sale', async () => {
  const settings = { mailFromEmail: 'tienda@example.com', mailProvider: 'resend', resendApiKey: 're_test' };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '' });
  try {
    const { getMailSender } = loader({
      '@/lib/settings': { getStoreSettingsRow: async () => settings },
      '@/lib/usage': { addUsage: async () => { throw new Error('base caída'); } },
    })('@/lib/mailer');
    const sender = await getMailSender();
    assert.equal((await sender.send('a@example.com', 'Hola', '<p>x</p>')).ok, true);
  } finally { globalThis.fetch = realFetch; }
});
