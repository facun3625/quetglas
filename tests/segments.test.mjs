import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// segments.ts es puro: se carga directo
const source = readFileSync('src/lib/segments.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(module, exports) {${code}\n})`)(mod, mod.exports);
const { matchesSegment, averageDaysBetween, EMPTY_STATS } = mod.exports;

const NOW = new Date('2026-10-01T12:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const customer = (over = {}, stats = {}) => ({
  id: 'u', email: 'u@x.com', name: 'U', role: 'customer', points: 0, createdAt: daysAgo(400),
  stats: { ...EMPTY_STATS, orderDates: [], couponIds: [], ...stats }, ...over,
});
const buyer = (dates, spent = 1000, extra = {}) => ({
  orders: dates.length, spent, orderDates: dates, firstOrderAt: dates[0] ?? null, lastOrderAt: dates[dates.length - 1] ?? null, couponIds: [], ...extra,
});

test('new customers: registered within the window', () => {
  assert.equal(matchesSegment('new_customers', { days: 30 }, customer({ createdAt: daysAgo(10) }), NOW), true);
  assert.equal(matchesSegment('new_customers', { days: 30 }, customer({ createdAt: daysAgo(45) }), NOW), false);
});

test('frequent: counts all orders, or only those inside the window', () => {
  const c = customer({}, buyer([daysAgo(300), daysAgo(200), daysAgo(5)]));
  assert.equal(matchesSegment('frequent', { minOrders: 3, days: 0 }, c, NOW), true);
  assert.equal(matchesSegment('frequent', { minOrders: 3, days: 30 }, c, NOW), false);
  assert.equal(matchesSegment('frequent', { minOrders: 4 }, c, NOW), false);
});

test('high spend needs at least one purchase and the minimum amount', () => {
  assert.equal(matchesSegment('high_spend', { minSpent: 5000 }, customer({}, buyer([daysAgo(3)], 6000)), NOW), true);
  assert.equal(matchesSegment('high_spend', { minSpent: 5000 }, customer({}, buyer([daysAgo(3)], 4000)), NOW), false);
  assert.equal(matchesSegment('high_spend', { minSpent: 0 }, customer(), NOW), false, 'sin compras no es de alto gasto');
});

test('inactive: bought before, but not recently (never-buyers are excluded)', () => {
  assert.equal(matchesSegment('inactive', { days: 90 }, customer({}, buyer([daysAgo(200)])), NOW), true);
  assert.equal(matchesSegment('inactive', { days: 90 }, customer({}, buyer([daysAgo(20)])), NOW), false);
  assert.equal(matchesSegment('inactive', { days: 90 }, customer(), NOW), false);
});

test('never purchased: no orders, registered long enough ago', () => {
  assert.equal(matchesSegment('never_purchased', { days: 7 }, customer({ createdAt: daysAgo(30) }), NOW), true);
  assert.equal(matchesSegment('never_purchased', { days: 7 }, customer({ createdAt: daysAgo(2) }), NOW), false);
  assert.equal(matchesSegment('never_purchased', { days: 0 }, customer({ createdAt: daysAgo(1) }), NOW), true);
  assert.equal(matchesSegment('never_purchased', { days: 0 }, customer({}, buyer([daysAgo(3)])), NOW), false);
});

test('with points and from coupon', () => {
  assert.equal(matchesSegment('with_points', { minPoints: 100 }, customer({ points: 150 }), NOW), true);
  assert.equal(matchesSegment('with_points', { minPoints: 100 }, customer({ points: 99 }), NOW), false);
  const c = customer({}, buyer([daysAgo(3)], 100, { couponIds: ['c1'] }));
  assert.equal(matchesSegment('from_coupon', { couponId: 'c1' }, c, NOW), true);
  assert.equal(matchesSegment('from_coupon', { couponId: 'c2' }, c, NOW), false);
  assert.equal(matchesSegment('from_coupon', {}, c, NOW), true, 'sin cupón elegido = cualquiera');
  assert.equal(matchesSegment('from_coupon', {}, customer(), NOW), false);
});

test('average days between purchases', () => {
  assert.equal(averageDaysBetween([daysAgo(5)]), null);
  assert.equal(Math.round(averageDaysBetween([daysAgo(30), daysAgo(0), daysAgo(15)])), 15);
});
