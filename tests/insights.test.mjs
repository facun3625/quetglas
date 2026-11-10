import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('src/lib/insightsCalc.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(module, exports) {${code}\n})`)(mod, mod.exports);
const { conversion, customerMetrics, aggregateSearches, aggregateCoupons, pctChange, previousRange, productSlugFromPath } = mod.exports;

const d = (iso) => new Date(iso);
const order = (over = {}) => ({ id: 'o', email: 'a@x.com', total: 100, createdAt: d('2026-10-05T00:00:00Z'), couponId: null, couponDiscount: 0, ...over });

test('conversion: rates over sessions, and no division by zero', () => {
  const c = conversion(200, 40, 10);
  assert.equal(c.orderRate, 0.05); assert.equal(c.cartRate, 0.2); assert.equal(c.cartToOrderRate, 0.25);
  const empty = conversion(0, 0, 0);
  assert.equal(empty.orderRate, null); assert.equal(empty.cartToOrderRate, null);
});

test('returning vs first-time buyers, and average days between purchases', () => {
  const rangeOrders = [order({ email: 'A@x.com' }), order({ email: 'a@x.com', id: 'o2' }), order({ email: 'b@x.com', id: 'o3' }), order({ email: 'c@x.com', id: 'o4' })];
  const earlier = new Set(['a@x.com', 'c@x.com']);
  const all = [
    { email: 'a@x.com', createdAt: d('2026-09-01T00:00:00Z') }, { email: 'a@x.com', createdAt: d('2026-09-11T00:00:00Z') }, { email: 'A@x.com', createdAt: d('2026-09-21T00:00:00Z') },
    { email: 'b@x.com', createdAt: d('2026-10-05T00:00:00Z') },
  ];
  const m = customerMetrics(rangeOrders, earlier, all);
  assert.equal(m.buyers, 3); assert.equal(m.returningBuyers, 2); assert.equal(m.firstTimeBuyers, 1);
  assert.equal(Math.round(m.repeatRate * 100), 67);
  assert.equal(m.avgDaysBetweenPurchases, 10, 'a compra cada 10 días; b y c no cuentan (una sola compra)');
  assert.equal(customerMetrics([], new Set(), []).avgDaysBetweenPurchases, null);
});

test('searches: top terms, zero-result terms and averages', () => {
  const rows = [
    { term: 'taza', resultsCount: 4 }, { term: 'taza', resultsCount: 4 }, { term: 'jarra', resultsCount: 0 }, { term: 'jarra', resultsCount: 0 },
    { term: 'jarra', resultsCount: 2 }, { term: 'mate', resultsCount: 0 },
  ];
  const s = aggregateSearches(rows);
  assert.equal(s.total, 6); assert.equal(s.distinct, 3); assert.equal(s.withoutResults, 3);
  assert.deepEqual(s.top.map((t) => t.term), ['jarra', 'taza', 'mate']);
  assert.deepEqual(s.noResults.map((t) => [t.term, t.withoutResults]), [['jarra', 2], ['mate', 1]]);
  assert.equal(s.top.find((t) => t.term === 'taza').avgResults, 4);
});

test('coupons: uses, revenue, discount and share of orders per coupon', () => {
  const orders = [
    order({ couponId: 'c1', total: 900, couponDiscount: 100 }), order({ couponId: 'c1', total: 450, couponDiscount: 50 }),
    order({ couponId: 'c2', total: 2000, couponDiscount: 200 }), order({ couponId: 'gone', total: 10, couponDiscount: 1 }), order(),
  ];
  const r = aggregateCoupons(orders, [{ id: 'c1', code: 'VERANO' }, { id: 'c2', code: 'BIENVENIDA' }]);
  assert.equal(r.ordersWithCoupon, 4); assert.equal(r.couponShare, 0.8); assert.equal(r.discountGiven, 351);
  assert.deepEqual(r.perCoupon.map((c) => c.code), ['BIENVENIDA', 'VERANO', '(cupón eliminado)']);
  const verano = r.perCoupon.find((c) => c.code === 'VERANO');
  assert.equal(verano.uses, 2); assert.equal(verano.revenue, 1350); assert.equal(verano.avgTicket, 675);
});

test('period comparison helpers', () => {
  assert.equal(pctChange(150, 100), 50); assert.equal(pctChange(50, 100), -50);
  assert.equal(pctChange(10, 0), null); assert.equal(pctChange(null, 5), null);
  const prev = previousRange({ from: d('2026-10-11T00:00:00Z'), to: d('2026-10-20T23:59:59.999Z') });
  assert.equal(prev.to.getTime(), d('2026-10-11T00:00:00Z').getTime() - 1);
  assert.ok(Math.abs((prev.to.getTime() - prev.from.getTime()) - (d('2026-10-20T23:59:59.999Z').getTime() - d('2026-10-11T00:00:00Z').getTime())) <= 1, 'misma duración');
});

test('product slug from a visited path', () => {
  assert.equal(productSlugFromPath('/producto/taza-azul'), 'taza-azul');
  assert.equal(productSlugFromPath('/producto/taza%20azul?x=1'), 'taza azul');
  assert.equal(productSlugFromPath('/tienda'), null);
});
