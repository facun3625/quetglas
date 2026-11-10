import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
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

// ---- Firma del webhook ----
const mp = loader()('@/lib/mercadopago');
const sign = (secret, dataId, requestId, ts) => `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex')}`;

test('signature: valid, tampered, wrong secret and missing headers', () => {
  const args = { secret: 's3cret', requestId: 'req-1', dataId: '123456' };
  assert.equal(mp.verifyMercadoPagoSignature({ ...args, signatureHeader: sign('s3cret', '123456', 'req-1', '1700000000') }), true);
  assert.equal(mp.verifyMercadoPagoSignature({ ...args, signatureHeader: sign('otra', '123456', 'req-1', '1700000000') }), false);
  assert.equal(mp.verifyMercadoPagoSignature({ ...args, dataId: '999', signatureHeader: sign('s3cret', '123456', 'req-1', '1700000000') }), false);
  assert.equal(mp.verifyMercadoPagoSignature({ ...args, signatureHeader: null }), false);
  assert.equal(mp.verifyMercadoPagoSignature({ ...args, signatureHeader: 'basura' }), false);
});

// ---- Conciliación ----
function fixture(orderOverrides = {}, options = {}) {
  const events = [];
  const order = { id: 'o1', status: 'pending', paymentMethod: 'mercadopago', total: 1000, mercadopagoPaymentId: null, ...orderOverrides };
  const history = [];
  const prisma = {
    order: {
      findUnique: async () => ({ ...order }),
      update: async ({ data }) => { Object.assign(order, data); return { ...order }; },
      updateMany: async ({ where, data }) => {
        if (where.status && order.status !== where.status) return { count: 0 };
        Object.assign(order, data); return { count: 1 };
      },
    },
    orderEvent: { findFirst: async ({ where }) => history.find((h) => h.message === where.message) ?? null },
    $transaction: async (cb) => cb(prisma),
  };
  class InsufficientStockError extends Error {}
  const load = loader({
    '@/lib/prisma': { prisma },
    '@/lib/mercadopago': { getMercadoPagoPayment: async () => { throw new Error('no usado'); }, refundMercadoPagoPayment: async () => ({ ok: true }), searchMercadoPagoPayments: async () => options.search ?? [] },
    '@/lib/orderFlow': {
      addOrderEvent: async (_id, type, message) => { history.push({ type, message }); },
      finalizeOrder: async () => { events.push('finalize'); return true; },
    },
    '@/lib/stock': {
      InsufficientStockError,
      cancelOrder: async () => { order.status = 'cancelled'; events.push('cancel'); },
      deductStockForOrder: async () => { if (options.noStock) throw new InsufficientStockError('x'); events.push('deduct'); },
    },
  });
  const refunds = [];
  const deps = { accessToken: 'tok', refund: async (id) => { refunds.push(id); return { ok: !options.refundFails, error: 'falló' }; } };
  return { lib: load('@/lib/mpReconcile'), order, events, history, refunds, deps };
}
const pay = (extra = {}) => ({ id: 777, status: 'approved', external_reference: 'o1', transaction_amount: 1000, ...extra });

test('approved payment confirms a pending order once and finalizes it once', async () => {
  const f = fixture();
  assert.equal((await f.lib.applyMercadoPagoPayment(pay(), f.deps)).action, 'confirmed');
  assert.equal(f.order.status, 'confirmed'); assert.equal(f.order.mercadopagoPaymentId, 777);
  assert.equal((await f.lib.applyMercadoPagoPayment(pay(), f.deps)).action, 'noop');
  assert.equal(f.events.filter((e) => e === 'finalize').length, 1);
});

test('rejected payment cancels a pending order and restores stock', async () => {
  const f = fixture();
  assert.equal((await f.lib.applyMercadoPagoPayment(pay({ status: 'rejected' }), f.deps)).action, 'cancelled');
  assert.equal(f.order.status, 'cancelled');
  // un rechazo tardío no toca un pedido ya confirmado
  const g = fixture({ status: 'confirmed', mercadopagoPaymentId: 1 });
  assert.equal((await g.lib.applyMercadoPagoPayment(pay({ id: 5, status: 'rejected' }), g.deps)).action, 'noop');
  assert.equal(g.order.status, 'confirmed');
});

test('approved amount that differs from the order total never confirms it', async () => {
  const f = fixture();
  assert.equal((await f.lib.applyMercadoPagoPayment(pay({ transaction_amount: 10 }), f.deps)).action, 'review');
  assert.equal(f.order.status, 'pending');
  assert.ok(f.history.some((h) => /monto distinto/.test(h.message)));
});

test('a second approved payment on an already paid order is refunded as duplicate', async () => {
  const f = fixture({ status: 'confirmed', mercadopagoPaymentId: 100 });
  assert.equal((await f.lib.applyMercadoPagoPayment(pay({ id: 200 }), f.deps)).action, 'refunded_duplicate');
  assert.deepEqual(f.refunds, [200]);
  assert.equal(f.order.mercadopagoPaymentId, 100, 'el cobro original no se pisa');
  const g = fixture({ status: 'confirmed', mercadopagoPaymentId: 100 }, { refundFails: true });
  assert.equal((await g.lib.applyMercadoPagoPayment(pay({ id: 200 }), g.deps)).action, 'review');
  assert.ok(g.history.some((h) => /NO se pudo devolver/.test(h.message)));
});

test('approval of a cancelled order reopens it when there is stock, refunds when there is not', async () => {
  const f = fixture({ status: 'cancelled' });
  assert.equal((await f.lib.applyMercadoPagoPayment(pay(), f.deps)).action, 'reopened');
  assert.equal(f.order.status, 'confirmed'); assert.deepEqual(f.events, ['deduct', 'finalize']);
  const g = fixture({ status: 'cancelled' }, { noStock: true });
  assert.equal((await g.lib.applyMercadoPagoPayment(pay(), g.deps)).action, 'refunded_duplicate');
  assert.equal(g.order.status, 'cancelled'); assert.deepEqual(g.refunds, [777]);
});

test('refunds and chargebacks cancel the order; delivered orders are flagged for review', async () => {
  const f = fixture({ status: 'confirmed', mercadopagoPaymentId: 777 });
  assert.equal((await f.lib.applyMercadoPagoPayment(pay({ status: 'refunded' }), f.deps)).action, 'cancelled');
  const g = fixture({ status: 'delivered', mercadopagoPaymentId: 777 });
  assert.equal((await g.lib.applyMercadoPagoPayment(pay({ status: 'charged_back' }), g.deps)).action, 'review');
  assert.equal(g.order.status, 'delivered');
});

test('in-process payments keep the order pending and log once', async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) assert.equal((await f.lib.applyMercadoPagoPayment(pay({ status: 'in_process' }), f.deps)).action, 'pending');
  assert.equal(f.order.status, 'pending');
  assert.equal(f.history.length, 1);
});

test('payments that are not ours are ignored', async () => {
  const f = fixture();
  assert.equal((await f.lib.applyMercadoPagoPayment({ id: 1, status: 'approved' }, f.deps)).action, 'ignored');
  assert.equal((await f.lib.applyMercadoPagoPayment(pay({ external_reference: 'otro' }), f.deps)).action, 'confirmed', 'el stub devuelve siempre o1: solo verifica que no explote');
  const g = fixture({ paymentMethod: 'payway' });
  assert.equal((await g.lib.applyMercadoPagoPayment(pay(), g.deps)).action, 'ignored');
});

test('manual reconciliation applies the approved payment first and reports when there are none', async () => {
  const f = fixture({}, { search: [pay({ id: 1, status: 'rejected' }), pay({ id: 2 })] });
  const result = await f.lib.reconcileOrder('o1', 'tok');
  assert.equal(result.found, 2);
  assert.equal(f.order.status, 'confirmed', 'el aprobado se aplica antes que el rechazado y este no lo revierte');
  const g = fixture({}, { search: [] });
  assert.equal((await g.lib.reconcileOrder('o1', 'tok')).found, 0);
  assert.ok(g.history.some((h) => /no tiene pagos/.test(h.message)));
});
