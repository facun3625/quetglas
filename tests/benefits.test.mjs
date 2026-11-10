import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { sanitizeBenefits, resolveBenefitIcon, BENEFIT_ICONS, LEGACY_KEYS, MAX_BENEFITS } = loader({ 'lucide-react': new Proxy({}, { get: (_t, name) => (name === '__esModule' ? true : () => null) }) })('@/lib/benefitIcons');

test('franja de beneficios: solo ítems válidos, íconos conocidos y hasta 6', () => {
  assert.deepEqual(sanitizeBenefits(null), []);
  assert.deepEqual(sanitizeBenefits('x'), []);
  const out = sanitizeBenefits([
    { icon: 'truck', title: ' Envíos ', subtitle: 'Rápidos' },
    { icon: 'no-existe', title: 'Sin ícono válido', subtitle: '' },   // ícono desconocido → etiqueta
    { icon: 'TruckIcon', title: 'Clave vieja', subtitle: '' },        // clave del selector anterior
    { icon: 'star', title: '', subtitle: '' },                         // vacío: se descarta
    { icon: 'gift', title: 'T'.repeat(200), subtitle: 'S'.repeat(500) },
    ...Array.from({ length: 10 }, (_, i) => ({ icon: 'heart', title: `Extra ${i}`, subtitle: '' })),
  ]);
  assert.equal(out.length, MAX_BENEFITS);
  assert.deepEqual(out[0], { icon: 'truck', title: 'Envíos', subtitle: 'Rápidos' });
  assert.equal(out[1].icon, 'tag'); assert.equal(out[2].icon, 'truck');
  assert.equal(out[3].title.length, 80); assert.equal(out[3].subtitle.length, 120);
});

test('íconos: las claves viejas se traducen y el catálogo no tiene repetidos', () => {
  for (const [legacy, now] of Object.entries(LEGACY_KEYS)) assert.equal(resolveBenefitIcon(legacy).key, now, legacy);
  const keys = BENEFIT_ICONS.map((i) => i.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(resolveBenefitIcon(undefined).key, 'tag');
});
