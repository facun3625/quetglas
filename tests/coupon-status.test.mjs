import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { couponKind, couponStatus, KIND_LABEL, STATUS_LABEL } = loader()('@/app/admin/(dashboard)/cupones/couponStatus');
const NOW = new Date('2026-10-06T12:00:00Z').getTime();
const base = { enabled: true, expiresAt: null, maxUses: null, usedCount: 0 };

test('cupones: el tipo sale del prefijo del código', () => {
  assert.equal(couponKind('TIENDA-AB12CD'), 'quick');
  assert.equal(couponKind('CANJE-XY99ZZ'), 'points');
  assert.equal(couponKind('BIENVENIDA-ABC'), 'welcome');
  assert.equal(couponKind('VERANO20'), 'regular');
  assert.equal(couponKind('tienda-minuscula'), 'regular', 'solo los códigos generados por el sistema cuentan como rápidos');
  assert.deepEqual(Object.keys(KIND_LABEL).sort(), ['points', 'quick', 'regular', 'welcome']);
});

test('cupones: estado activo, usado, vencido y deshabilitado', () => {
  assert.equal(couponStatus(base, NOW), 'active');
  assert.equal(couponStatus({ ...base, enabled: false }, NOW), 'disabled');
  assert.equal(couponStatus({ ...base, expiresAt: new Date(NOW - 1000) }, NOW), 'expired');
  assert.equal(couponStatus({ ...base, expiresAt: new Date(NOW + 86400000) }, NOW), 'active');
  assert.equal(couponStatus({ ...base, maxUses: 1, usedCount: 1 }, NOW), 'used');
  assert.equal(couponStatus({ ...base, maxUses: 5, usedCount: 4 }, NOW), 'active');
  // Un cupón de canje se deshabilita solo al usarse: tiene que verse como "Usado", no como "Deshabilitado"
  assert.equal(couponStatus({ ...base, enabled: false, maxUses: 1, usedCount: 1 }, NOW), 'used');
  assert.deepEqual(Object.keys(STATUS_LABEL).sort(), ['active', 'disabled', 'expired', 'used']);
});
