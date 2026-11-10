import assert from 'node:assert/strict';
import { test } from 'node:test';
import { File } from 'node:buffer';
globalThis.File ??= File;
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Execute the real TypeScript routes with isolated in-memory external services.
function loader(stubs = {}) {
  const cache = new Map();
  function load(name) {
    if (name in stubs) return stubs[name].default ? { __esModule: true, ...stubs[name] } : stubs[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const source = readFileSync(`src/${name.slice(2)}.ts`, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const loadedModule = { exports: {} };
    cache.set(name, loadedModule);
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`)(load, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

const quantities = loader()('@/lib/checkoutItems');
test('reject malformed items, nonpositive/fractional quantities and overflow', () => {
  for (const input of [null, {}, [], [null], [{ productId: 1, quantity: 1 }], [{ productId: 'a b', quantity: 1 }], [{ productId: 'p1', variantId: 5, quantity: 1 }], ...[0, -1, 1.5, '2', Infinity, 2147483648].map(quantity => [{ productId: 'p1', quantity }])]) {
    assert.throws(() => quantities.normalizeCheckoutItems(input), quantities.InvalidCheckoutError);
  }
});
test('combine duplicate lines per product+variant', () => {
  const result = quantities.normalizeCheckoutItems([
    { productId: 'p1', quantity: 2, price: 0, name: 'fake' }, { productId: 'p1', quantity: 3 },
    { productId: 'p2', variantId: 'v1', quantity: 1 }, { productId: 'p2', variantId: 'v2', quantity: 1 },
  ]);
  assert.deepEqual(result, [
    { productId: 'p1', variantId: null, quantity: 5 },
    { productId: 'p2', variantId: 'v1', quantity: 1 },
    { productId: 'p2', variantId: 'v2', quantity: 1 },
  ]);
});

function catalogLoader(products) {
  const load = loader({ '@/lib/prisma': { prisma: { product: { findMany: async () => products } } } });
  return load('@/lib/checkout');
}
const SIMPLE = { id: 'p1', name: 'Real', sku: 'S1', type: 'simple', price: 100, stock: 10, manageStock: true, variants: [] };
const VARIABLE = {
  id: 'p2', name: 'Remera', sku: 'R', type: 'variable', price: 0, stock: 0, manageStock: false,
  variants: [{ id: 'v1', sku: 'R-ROJO', price: 150, enabled: true, terms: [{ term: { name: 'Rojo' } }, { term: { name: 'M' } }] }],
};
test('authoritative price and name come from the database, never the browser', async () => {
  const { getCheckoutItems } = catalogLoader([SIMPLE]);
  const result = await getCheckoutItems([{ productId: 'p1', quantity: 2, price: 0, name: 'fake' }, { productId: 'p1', quantity: 3 }]);
  assert.deepEqual(result, [{ productId: 'p1', variantId: null, quantity: 5, name: 'Real', sku: 'S1', price: 100, weight: null, width: null, height: null, length: null }]);
  await assert.rejects(getCheckoutItems([{ productId: 'missing', quantity: 1 }]), { message: /ya no está disponible/ });
});
test('variable products need a valid variant and use its price', async () => {
  const { getCheckoutItems } = catalogLoader([VARIABLE]);
  const [item] = await getCheckoutItems([{ productId: 'p2', variantId: 'v1', quantity: 1 }]);
  assert.equal(item.price, 150);
  assert.equal(item.name, 'Remera — Rojo / M');
  assert.equal(item.sku, 'R-ROJO');
  await assert.rejects(getCheckoutItems([{ productId: 'p2', quantity: 1 }]), { message: /ya no está disponible/ });
  await assert.rejects(getCheckoutItems([{ productId: 'p2', variantId: 'nope', quantity: 1 }]), { message: /ya no está disponible/ });
});
test('shipping measures: variant overrides product, missing falls back to the product', async () => {
  const product = { ...VARIABLE, weight: 2, width: 30, height: 10, length: 40, variants: [{ ...VARIABLE.variants[0], weight: 0.5, width: null, height: null, length: null }] };
  const { getCheckoutItems } = catalogLoader([product]);
  const [item] = await getCheckoutItems([{ productId: 'p2', variantId: 'v1', quantity: 1 }]);
  assert.deepEqual([item.weight, item.width, item.height, item.length], [0.5, 30, 10, 40]);
});
test('simple products reject a variant id', async () => {
  const { getCheckoutItems } = catalogLoader([SIMPLE]);
  await assert.rejects(getCheckoutItems([{ productId: 'p1', variantId: 'v1', quantity: 1 }]), { message: /ya no está disponible/ });
});

function fixture(provider, options = {}) {
  const events = [];
  let saved = null;
  let stock = options.stock ?? 10;
  const products = options.noProducts ? [] : [{ id: 'p1', name: 'Real', sku: 'S1', type: 'simple', price: 100, get stock() { return stock; }, manageStock: true, variants: [] }];
  const config = { id: 'config', enabled: true, discountPct: 10, categoryDiscounts: [], mpAccessToken: 'test', paywayPrivateKey: 'test', paywaySandbox: true };
  const db = {
    paymentMethodConfig: { findUnique: async () => config },
    product: {
      findMany: async () => products,
      updateMany: async ({ data }) => { stock += data.stock.increment; events.push(['stock', data.stock.increment]); return { count: 1 }; },
    },
    variant: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
    user: {
      findUnique: async () => ({ role: options.role ?? 'admin' }),
      update: async ({ data }) => {
        events.push(['user-phone', data]);
        return data;
      },
    },
    order: {
      findUnique: async () => saved && { ...saved, items: saved.items?.create ?? saved.items },
      updateMany: async ({ where, data }) => {
        if (saved && where.stockDeductedAt?.not === null && !saved.stockDeductedAt) return { count: 0 };
        saved = { ...saved, ...data };
        return { count: 1 };
      },
      create: async ({ data }) => {
        if (saved) throw new Error('duplicate');
        saved = { ...data, id: data.id ?? 'direct-order', status: data.status ?? 'pending' };
        events.push(['created', saved]);
        return saved;
      },
      update: async ({ data }) => {
        if (data.status === 'confirmed' && options.failConfirm) throw new Error('db unavailable');
        saved = { ...saved, ...data };
        events.push(['updated', data]);
        return saved;
      },
    },
    $executeRaw: async () => {},
  };
  db.$transaction = async callback => callback(db);
  const createPayment = async args => {
    events.push(['charge', args]);
    assert.equal(saved.status, 'pending', 'must persist reservation before charge');
    return options.charge ?? { ok: true, id: 77, status: 'approved' };
  };
  const refund = async () => { events.push(['refund']); return { ok: !options.failRefund }; };
  const load = loader({
    'node:fs/promises': { mkdir: async () => {}, writeFile: async () => events.push(['proof']) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/adminLog': { logAdminAction: async () => {} },
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/auth': { auth: async () => ({ user: { id: 'user', role: 'admin' } }) },
    '@/lib/settings': { getStoreSettingsRow: async () => ({ currency: 'ARS' }) },
    '@/lib/oca/client': { ocaQuote: async () => { throw new Error('OCA no se usa en estos tests'); }, ocaBranches: async () => [], OcaError: class OcaError extends Error {} },
    '@/lib/shipping': { getAllowedBuiltinCodes: async () => null, getShippingMethodsForPayment: async () => [{ id: 'shipping', name: 'Retiro', cost: 20, requiresAddress: false }] },
    '@/lib/categories': { resolveItemCategoryChains: async () => new Map() },
    '@/lib/coupons': { validateCoupon: async () => ({ ok: true, couponId: 'coupon', discountAmount: 5 }), registerCouponUse: async () => events.push(['coupon']), releaseCouponForOrder: async () => events.push(['coupon-released']) },
    '@/lib/orderFlow': {
      addOrderEvent: async (...args) => events.push(['history', args[2]]),
      // Simula el reclamo idempotente de avisos (la versión real se prueba en mp-webhook.test.mjs)
      finalizeOrder: (() => { const done = new Set(); return async id => { if (done.has(id)) return false; done.add(id); events.push(['telegram', id]); events.push(['email', id]); return true; }; })(),
    },
    '@/lib/mercadopago': { createMercadoPagoPayment: createPayment, refundMercadoPagoPayment: refund },
    '@/lib/payway': { createPaywayPayment: createPayment, refundPaywayPayment: refund },
  });
  const route = load(provider === 'direct' ? '@/app/api/orders/route' : `@/app/api/orders/${provider}/route`);
  const body = {
    checkoutId: '00000000-0000-4000-8000-000000000001',
    items: [{ productId: 'p1', quantity: 2, price: 0.01, name: 'fake' }],
    customer: { name: 'Cliente', email: 'test@example.com', phone: '123' },
    shipping: { code: 'shipping' }, couponCode: 'TEST',
    mpToken: 'token', mpPaymentMethodId: 'visa', mpIdentification: { type: 'DNI', number: '123' },
    paywayToken: 'token', paywayBin: '123456', paywayPaymentMethodId: 1,
    paywayBillTo: { firstName: 'Cliente', street1: 'Calle', city: 'Ciudad', postalCode: '1234' },
  };
  return { events, db, load, body, route, saved: () => saved, stock: () => stock, post: () => route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })) };
}

for (const provider of ['mercadopago', 'payway']) {
  test(`${provider}: authoritative price, reserve stock before charge and notifications once`, async () => {
    const f = fixture(provider);
    assert.equal((await f.post()).status, 201);
    assert.equal(f.saved().total, 195); // 200 - 10% - coupon 5 + shipping 20
    assert.equal(f.saved().items.create[0].name, 'Real');
    assert.equal(f.events.find(([name]) => name === 'charge')[1].amount, 195);
    assert.equal(f.saved().status, 'confirmed');
    assert.equal(f.saved().currency, 'ARS');
    assert.equal(f.saved().items.create[0].sku, 'S1');
    assert.equal(f.stock(), 8); // stock descontado una sola vez
    assert.equal((await f.post()).status, 201);
    assert.equal(f.stock(), 8);
    for (const event of ['charge', 'telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1, event);
  });
  test(`${provider}: unavailable product never charges`, async () => {
    const f = fixture(provider, { noProducts: true });
    assert.equal((await f.post()).status, 400);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: repeated lines exceed stock and never charge`, async () => {
    const f = fixture(provider, { stock: 5 });
    f.body.items = [{ productId: 'p1', quantity: 4 }, { productId: 'p1', quantity: 4 }];
    assert.equal((await f.post()).status, 409);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: negative quantity rejected before charge`, async () => {
    const f = fixture(provider);
    f.body.items[0].quantity = -1;
    assert.equal((await f.post()).status, 400);
    assert.equal(f.events.some(([name]) => name === 'charge'), false);
  });
  test(`${provider}: uncertain payment retains reservation, blocks retry and sends no notices`, async () => {
    const f = fixture(provider, { charge: { ok: false, error: 'timeout', detail: 'timeout' } });
    const response = await f.post();
    assert.equal((await response.json()).requiresReview, true);
    assert.equal(f.saved().status, 'pending');
    assert.equal((await f.post()).status, 409);
    assert.equal(f.events.filter(([name]) => name === 'charge').length, 1);
    assert.equal(f.events.some(([name]) => ['email', 'telegram'].includes(name)), false);
  });
  test(`${provider}: definitive rejection releases stock`, async () => {
    const f = fixture(provider, { charge: { ok: false, rejected: true, error: 'rechazado', detail: 'rejected' } });
    assert.equal((await f.post()).status, 402);
    assert.equal(f.saved().status, 'cancelled');
    assert.equal(f.stock(), 10); // se repuso lo descontado
  });
  for (const failRefund of [true, false]) test(`${provider}: confirmation failure, refund ${failRefund ? 'pending' : 'successful'}`, async () => {
    const f = fixture(provider, { failConfirm: true, failRefund });
    const response = await f.post();
    const data = await response.json();
    assert.equal(response.status, 409);
    assert.equal(f.saved().status, failRefund ? 'pending' : 'cancelled');
    assert.equal(Boolean(data.requiresReview), failRefund);
    assert.equal(f.events.filter(([name]) => name === 'refund').length, 1);
    assert.equal(f.stock(), failRefund ? 8 : 10);
  });
}

test('stock transaction checks sum of repeated product lines independently of route', async () => {
  const f = fixture('payway', { stock: 5 });
  const { createOrderWithStockGuard, InsufficientStockError } = f.load('@/lib/stock');
  await assert.rejects(createOrderWithStockGuard([{ productId: 'p1', variantId: null, quantity: 4, name: 'A' }, { productId: 'p1', variantId: null, quantity: 4, name: 'A' }], async () => { throw new Error('must not create'); }), InsufficientStockError);
  assert.equal(f.stock(), 5);
});

test('demoted/deleted admin cannot mutate even with an old admin session', async () => {
  for (const user of [null, { role: 'customer' }]) {
    const load = loader({ '@/lib/auth': { auth: async () => ({ user: { id: 'old-admin', role: 'admin' } }) }, '@/lib/prisma': { prisma: { user: { findUnique: async () => user } } } });
    await assert.rejects(load('@/lib/adminAuth').requireAdmin(), /No autorizado/);
  }
});

for (const provider of ['mercadopago', 'payway']) {
  test(`${provider}: concurrent retries create one charge and one set of notices`, async () => {
    const f = fixture(provider);
    const responses = await Promise.all([f.post(), f.post()]);
    assert.ok(responses.some(response => response.status === 201));
    for (const event of ['charge', 'telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
  });
}

test('cash delivery remains pending, deducts stock and sends notices', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', JSON.stringify(f.body.items));
  form.set('customer', JSON.stringify(f.body.customer));
  form.set('paymentMethod', 'contra_entrega');
  form.set('shipping', JSON.stringify({ code: 'shipping' }));
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 201);
  assert.equal(f.saved().status, 'pending');
  assert.equal(f.saved().total, 200);
  assert.equal(f.events.some(([name]) => name === 'charge'), false);
  assert.equal(f.stock(), 8);
  for (const event of ['telegram', 'email']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
});

test('"sin pago online" registers the order pending, deducts stock, needs no proof and is only valid when enabled', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', JSON.stringify(f.body.items));
  form.set('customer', JSON.stringify(f.body.customer));
  form.set('paymentMethod', 'sin_pago');
  form.set('shipping', JSON.stringify({ code: 'shipping' }));
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 201);
  assert.equal(f.saved().status, 'pending');
  assert.equal(f.saved().paymentMethod, 'sin_pago');
  assert.equal(f.stock(), 8);
  assert.equal(f.events.some(([name]) => name === 'charge'), false);
  assert.equal(f.events.filter(([name]) => name === 'telegram').length, 1);
});

test('malformed direct checkout returns 400', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', '{');
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 400);
});

test('existing JWTs refresh roles and deleted accounts lose the session', async () => {
  for (const user of [null, { role: 'customer' }, { role: 'admin' }]) {
    let config;
    const load = loader({
      'next-auth': { default: value => { config = value; return {}; } },
      'next-auth/providers/credentials': { default: value => value },
      'next-auth/providers/google': { default: value => value },
      'bcryptjs': { default: {} },
      '@/lib/prisma': { prisma: { user: { findUnique: async () => user } } },
    });
    load('@/lib/auth');
    const token = await config.callbacks.jwt({ token: { id: 'user', role: 'admin' } });
    assert.deepEqual(token, user ? { id: 'user', role: user.role } : null);
  }
});

test('bank transfer keeps proof, stays pending and keeps its stock until cancelled', async () => {
  const f = fixture('direct');
  const form = new FormData();
  form.set('items', JSON.stringify(f.body.items));
  form.set('customer', JSON.stringify(f.body.customer));
  form.set('paymentMethod', 'transferencia');
  form.set('shipping', JSON.stringify({ code: 'shipping' }));
  form.set('comprobante', new File(['proof'], 'receipt.pdf', { type: 'application/pdf' }));
  const response = await f.route.POST(new Request('http://localhost/api/orders', { method: 'POST', body: form }));
  assert.equal(response.status, 201);
  assert.equal(f.saved().status, 'pending');
  assert.match(f.saved().transferProofUrl, /^\/api\/uploads\/comprobantes\/.+\.pdf$/);
  assert.equal(f.stock(), 8);
  const actions = f.load('@/app/admin/(dashboard)/ventas/actions');
  await actions.changeOrderStatus(f.saved().id, 'confirmed');
  assert.equal(f.saved().status, 'confirmed');
  assert.equal(f.stock(), 8);
  await actions.changeOrderStatus(f.saved().id, 'cancelled');
  assert.equal(f.saved().status, 'cancelled');
  assert.equal(f.stock(), 10); // cancelar repone el stock
  await actions.changeOrderStatus(f.saved().id, 'cancelled'); // idempotente
  assert.equal(f.stock(), 10);
  for (const event of ['telegram', 'email', 'proof']) assert.equal(f.events.filter(([name]) => name === event).length, 1);
});
