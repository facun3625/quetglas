import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const ADDR = { street: 'Mitre', number: '100', apartment: '2B', city: 'Rosario', province: 'Santa Fe', zipCode: '2000' };
const BRANCHES = [{ id: 'b1', name: 'ROS1', address: 'San Martín 1', city: 'Rosario', zipCode: '2000' }];
const ITEMS = [{ quantity: 2, weight: 1.5, width: 20, height: 10, length: 30 }];
const baseRow = { ocaEnabled: true, ocaCuit: '30712345678', ocaOperativa: '111', ocaOriginZipCode: '3000', ocaBranchDiscountPct: 30, freeShippingEnabled: false, freeShippingThreshold: 0, acordarEnabled: true };

function setup({ row = {}, restrictions = [], discount = null, quote, allowed = null } = {}) {
  const calls = { quote: [] };
  const load = loader({
    '@/lib/prisma': { prisma: {
      zipCodeRestriction: { findMany: async ({ where }) => restrictions.filter((r) => r.zipCode === where.zipCode) },
      zipCodeDiscount: { findFirst: async ({ where }) => (discount && discount.zipCode === where.zipCode && discount.enabled ? discount : null) },
    } },
    '@/lib/settings': { getStoreSettingsRow: async () => ({ ...baseRow, ...row }) },
    '@/lib/shipping': { getAllowedBuiltinCodes: async () => allowed, getShippingMethodsForPayment: async () => [{ id: 'retiro', name: 'Retiro en local', description: '', cost: 0, requiresAddress: false }, { id: 'flete', name: 'Flete', description: '', cost: 900, requiresAddress: true }] },
  });
  const flow = load('@/lib/shippingFlow');
  const deps = {
    quote: async (cfg, args) => { calls.quote.push(args); if (quote) return quote(cfg, args); return { price: 1210, priceBeforeTax: 1000, iva: 210, deliveryDays: 4 }; },
    branches: async () => BRANCHES,
  };
  return { flow, deps, calls };
}
const resolve = (s, choice, extra = {}) => s.flow.resolveShipping({ choice, items: ITEMS, subtotal: 5000, paymentMethodConfigId: 'pm', deps: s.deps, ...extra });

test('pure rules: free shipping, zip discount and stacking', () => {
  const { flow } = setup();
  assert.equal(flow.isFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 5000 }, 5000), true);
  assert.equal(flow.isFreeShipping({ freeShippingEnabled: true, freeShippingThreshold: 5000 }, 4999), false);
  assert.equal(flow.isFreeShipping({ freeShippingEnabled: false, freeShippingThreshold: 5000 }, 9999), false);
  assert.equal(flow.isFreeShipping({ freeShippingEnabled: false, freeShippingThreshold: 0 }, 1, true), true); // cupón
  assert.equal(flow.zipDiscountAmount({ discountType: 'percentage', discountValue: 10 }, 5000), 500);
  assert.equal(flow.zipDiscountAmount({ discountType: 'fixed', discountValue: 99999 }, 5000), 5000);
  assert.equal(flow.zipDiscountAmount(null, 5000), 0);
  assert.equal(flow.stackDiscounts(1000, 800, 500), 1000);
});

test('OCA a domicilio: re-cotiza en el servidor con el peso y volumen reales', async () => {
  const s = setup();
  const r = await resolve(s, { code: 'oca_domicilio', address: ADDR });
  assert.equal(r.ok, true);
  assert.equal(r.cost, 1210);
  assert.equal(r.code, 'oca_domicilio');
  assert.equal(s.calls.quote[0].weightKg, 3); // 2 × 1,5 kg
  assert.ok(Math.abs(s.calls.quote[0].volumeM3 - 0.012) < 1e-9); // 2 × 20×10×30 cm
  assert.equal(r.data.zipCode, '2000');
  assert.match(r.addressText, /Mitre 100, 2B, Rosario, Santa Fe \(CP 2000\)/);
});

test('OCA sucursal: 30% menos y la sucursal debe ser una de las del código postal', async () => {
  const s = setup();
  const ok = await resolve(s, { code: 'oca_sucursal', branchId: 'b1', address: ADDR });
  assert.equal(ok.cost, 847);
  assert.equal(ok.data.branchName, 'ROS1');
  assert.equal(ok.data.isBranch, true);
  const bad = await resolve(s, { code: 'oca_sucursal', branchId: 'inventada', address: ADDR });
  assert.equal(bad.ok, false);
});

test('envío gratis por monto o por cupón deja el costo en 0', async () => {
  const s = setup({ row: { freeShippingEnabled: true, freeShippingThreshold: 4000 } });
  const r = await resolve(s, { code: 'oca_domicilio', address: ADDR });
  assert.equal(r.cost, 0); assert.equal(r.baseCost, 1210); assert.equal(r.isFree, true);
  const t = setup();
  const c = await resolve(t, { code: 'oca_domicilio', address: ADDR }, { couponFreeShipping: true });
  assert.equal(c.cost, 0);
});

test('restricciones: block_sale frena la venta, block_shipping oculta OCA y a acordar pero deja los métodos propios', async () => {
  const sale = setup({ restrictions: [{ zipCode: '2000', type: 'block_sale', message: 'No llegamos' }, { zipCode: '2000', type: 'block_shipping', message: 'x' }] });
  const a = await resolve(sale, { code: 'oca_domicilio', address: ADDR });
  assert.equal(a.ok, false); assert.equal(a.error, 'No llegamos'); assert.equal(a.status, 409);
  const ship = setup({ restrictions: [{ zipCode: '2000', type: 'block_shipping', message: 'Solo local' }] });
  assert.equal((await resolve(ship, { code: 'oca_domicilio', address: ADDR })).ok, false);
  assert.equal((await resolve(ship, { code: 'acordar', address: ADDR })).ok, false);
  const own = await resolve(ship, { code: 'flete', address: ADDR });
  assert.equal(own.ok, true); assert.equal(own.cost, 900);
  // con el interruptor de restricciones apagado no se aplica
  const off = setup({ row: { zipRestrictionsEnabled: false }, restrictions: [{ zipCode: '2000', type: 'block_sale', message: 'x' }] });
  assert.equal((await resolve(off, { code: 'oca_domicilio', address: ADDR })).ok, true);
});

test('descuento por código postal', async () => {
  const s = setup({ discount: { zipCode: '2000', enabled: true, discountType: 'percentage', discountValue: 10, label: 'Zona' } });
  const r = await resolve(s, { code: 'acordar', address: ADDR });
  assert.equal(r.zipDiscount, 500); assert.equal(r.cost, 0);
  const off = setup({ row: { zipDiscountsEnabled: false }, discount: { zipCode: '2000', enabled: true, discountType: 'percentage', discountValue: 10 } });
  assert.equal((await resolve(off, { code: 'acordar', address: ADDR })).zipDiscount, 0);
});

test('validaciones: OCA apagado, configuración incompleta, dirección inválida, métodos propios', async () => {
  assert.equal((await resolve(setup({ row: { ocaEnabled: false } }), { code: 'oca_domicilio', address: ADDR })).ok, false);
  const broken = setup({ quote: async () => { throw new (setup().flow.OcaError ?? Error)('config'); } });
  const f = await resolve(broken, { code: 'oca_domicilio', address: ADDR });
  assert.equal(f.ok, false); assert.equal(f.status, 502);
  assert.equal((await resolve(setup(), { code: 'oca_domicilio', address: { ...ADDR, province: 'Narnia' } })).ok, false);
  assert.equal((await resolve(setup(), { code: 'oca_domicilio', address: { ...ADDR, street: '' } })).ok, false);
  assert.equal((await resolve(setup(), { code: 'oca_domicilio', address: { ...ADDR, zipCode: 'X1A' } })).ok, false);
  const s = setup();
  const retiro = await resolve(s, { code: 'retiro' });
  assert.equal(retiro.ok, true); assert.equal(retiro.manualMethodId, 'retiro'); assert.equal(retiro.addressText, null);
  assert.equal((await resolve(s, { code: 'flete' })).ok, false); // pide dirección
  assert.equal((await resolve(s, { code: 'flete', address: ADDR })).cost, 900);
  assert.equal((await resolve(s, { code: 'inexistente' })).ok, false);
});

test('opciones del checkout: OCA, sucursales y acordar; con block_sale no se ofrece nada', async () => {
  const s = setup();
  const r = await s.flow.getShippingOptions({ zipCode: '2000', items: ITEMS, subtotal: 5000, deps: s.deps });
  assert.deepEqual(r.options.map((o) => o.code), ['oca_domicilio', 'oca_sucursal', 'acordar']);
  assert.equal(r.options[1].price, 847);
  assert.equal(r.options[1].branches.length, 1);
  const blocked = setup({ restrictions: [{ zipCode: '2000', type: 'block_sale', message: 'No' }] });
  const b = await blocked.flow.getShippingOptions({ zipCode: '2000', items: ITEMS, subtotal: 5000, deps: blocked.deps });
  assert.equal(b.restriction.type, 'block_sale'); assert.equal(b.options.length, 0);
  const failing = setup({ quote: async () => { throw new Error('caído'); } });
  const f = await failing.flow.getShippingOptions({ zipCode: '2000', items: ITEMS, subtotal: 5000, deps: failing.deps });
  assert.deepEqual(f.options.map((o) => o.code), ['acordar']);
});

test('medio de pago con modalidades permitidas: solo se ofrecen y aceptan las marcadas', async () => {
  const s = setup({ allowed: ['acordar'] });
  const r = await s.flow.getShippingOptions({ zipCode: '2000', items: ITEMS, subtotal: 5000, paymentMethodConfigId: 'pm', deps: s.deps });
  assert.deepEqual(r.options.filter((o) => o.kind !== 'manual').map((o) => o.code), ['acordar']);
  assert.equal(s.calls.quote.length, 0, 'ni siquiera cotiza OCA');
  assert.equal((await resolve(s, { code: 'oca_domicilio', address: ADDR })).ok, false);
  assert.equal((await resolve(s, { code: 'acordar', address: ADDR })).ok, true);
  const dom = setup({ allowed: ['oca_domicilio'] });
  const o = await dom.flow.getShippingOptions({ zipCode: '2000', items: ITEMS, subtotal: 5000, paymentMethodConfigId: 'pm', deps: dom.deps });
  assert.deepEqual(o.options.filter((x) => x.kind !== 'manual').map((x) => x.code), ['oca_domicilio']);
});
