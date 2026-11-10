import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const load = (file) => {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(module, exports) {${code}\n})`)(mod, mod.exports);
  return mod.exports;
};
const { effectivePricing, isPromoActive } = load('src/lib/pricing.ts');
const { isVisibleNow } = load('src/lib/catalogVisibility.ts');

const NOW = new Date('2026-10-10T12:00:00Z');
const d = (iso) => new Date(iso);

test('no promo: list price and stored crossed-out price', () => {
  assert.deepEqual(effectivePricing({ price: 100, compareAtPrice: 130 }, NOW), { price: 100, compareAtPrice: 130, onPromo: false });
});

test('promo inside its window replaces the price and crosses out the list price', () => {
  const p = { price: 100, compareAtPrice: null, promoPrice: 80, promoStartsAt: d('2026-10-01T00:00:00Z'), promoEndsAt: d('2026-10-31T00:00:00Z') };
  assert.deepEqual(effectivePricing(p, NOW), { price: 80, compareAtPrice: 100, onPromo: true });
});

test('promo outside its window (not started / ended) is ignored', () => {
  const base = { price: 100, compareAtPrice: null, promoPrice: 80 };
  assert.equal(isPromoActive({ ...base, promoStartsAt: d('2026-11-01T00:00:00Z'), promoEndsAt: null }, NOW), false);
  assert.equal(isPromoActive({ ...base, promoStartsAt: null, promoEndsAt: d('2026-10-01T00:00:00Z') }, NOW), false);
  assert.equal(effectivePricing({ ...base, promoStartsAt: null, promoEndsAt: d('2026-10-01T00:00:00Z') }, NOW).price, 100);
});

test('open-ended promo applies; invalid promo prices never raise the price', () => {
  assert.equal(effectivePricing({ price: 100, compareAtPrice: null, promoPrice: 70 }, NOW).price, 70);
  assert.equal(effectivePricing({ price: 100, compareAtPrice: null, promoPrice: 100 }, NOW).onPromo, false);
  assert.equal(effectivePricing({ price: 100, compareAtPrice: null, promoPrice: 150 }, NOW).price, 100);
  assert.equal(effectivePricing({ price: 100, compareAtPrice: null, promoPrice: -5 }, NOW).price, 100);
});

test('scheduled visibility: drafts hidden, publishAt/unpublishAt window respected', () => {
  assert.equal(isVisibleNow({ status: 'published', publishAt: null, unpublishAt: null }, NOW), true);
  assert.equal(isVisibleNow({ status: 'draft', publishAt: null, unpublishAt: null }, NOW), false);
  assert.equal(isVisibleNow({ status: 'published', publishAt: d('2026-10-20T00:00:00Z'), unpublishAt: null }, NOW), false);
  assert.equal(isVisibleNow({ status: 'published', publishAt: d('2026-10-01T00:00:00Z'), unpublishAt: d('2026-10-05T00:00:00Z') }, NOW), false);
  assert.equal(isVisibleNow({ status: 'published', publishAt: d('2026-10-01T00:00:00Z'), unpublishAt: d('2026-10-20T00:00:00Z') }, NOW), true);
});

const { dayToInstant, instantToDay } = load('src/lib/storeTime.ts');
test('store calendar days are interpreted in Argentina time (UTC-3), independent of the server timezone', () => {
  assert.equal(dayToInstant('2026-10-31').toISOString(), '2026-10-31T03:00:00.000Z');
  assert.equal(dayToInstant('2026-10-31', true).toISOString(), '2026-11-01T02:59:59.999Z');
  assert.equal(instantToDay(dayToInstant('2026-10-31', true)), '2026-10-31', 'ida y vuelta sin correrse de día');
  assert.equal(instantToDay(dayToInstant('2026-01-01')), '2026-01-01');
  assert.equal(dayToInstant('basura'), undefined);
  assert.equal(dayToInstant(''), undefined);
  assert.equal(instantToDay(null), '');
});
