import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { parseIconName, iconVersion } = loader({
  'server-only': {},
  '@/lib/settings': { getStoreSettingsRow: async () => ({}) },
})('@/lib/appIcon');

test('ícono de la app: solo los tamaños que existen', () => {
  assert.deepEqual(parseIconName('192.png'), { size: 192, maskable: false });
  assert.deepEqual(parseIconName('512.png'), { size: 512, maskable: false });
  assert.deepEqual(parseIconName('512-maskable.png'), { size: 512, maskable: true });
  for (const bad of ['192-maskable.png', '256.png', '512.jpg', '../512.png', '512.png/x', '', 'default-icon.png']) assert.equal(parseIconName(bad), null, bad);
});

test('ícono de la app: la versión cambia cuando cambia el favicon', () => {
  const a = iconVersion('/api/uploads/products/a.webp');
  assert.match(a, /^[0-9a-f]{8}$/);
  assert.equal(a, iconVersion('/api/uploads/products/a.webp'), 'el mismo favicon da la misma versión');
  assert.notEqual(a, iconVersion('/api/uploads/products/b.webp'));
  assert.notEqual(iconVersion(null), a);
  assert.equal(iconVersion(null), iconVersion(null));
});
