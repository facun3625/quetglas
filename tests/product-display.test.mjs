import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loader } from './helpers/loader.mjs';

const { sanitizeProductDisplay, discountPct, notesFor } = loader()('@/lib/productDisplay');

test('product display: defaults, sanitization and limits', () => {
  const empty = sanitizeProductDisplay(null);
  assert.equal(empty.discountBadge.enabled, false);
  assert.equal(empty.discountBadge.text, '-{pct}% OFF');
  assert.deepEqual(empty.notes, []);

  const d = sanitizeProductDisplay({
    discountBadge: { enabled: true, text: '', bg: 'red;}', color: '#ABCDEF' },
    notes: [
      { installments: 3, text: 'sin interés', logoUrl: 'javascript:alert(1)', place: 'card' },
      { installments: 99, text: 'Envío gratis', minPrice: '30000' },
      { installments: 0, text: '', logoUrl: '' },
      ...Array.from({ length: 10 }, () => ({ installments: 6, text: 'x', logoUrl: 'https://pub.r2.dev/a.webp' })),
    ],
  });
  assert.equal(d.discountBadge.text, '-{pct}% OFF', 'texto vacío vuelve al de fábrica');
  assert.equal(d.discountBadge.bg, '#e52327', 'color inválido se descarta');
  assert.equal(d.discountBadge.color, '#abcdef');
  assert.equal(d.notes.length, 6, 'máximo 6 y sin las vacías');
  assert.equal(d.notes[0].logoUrl, '', 'URL peligrosa se descarta');
  assert.equal(d.notes[0].place, 'card');
  assert.equal(d.notes[1].installments, 0, 'cuotas fuera de rango = texto libre');
  assert.equal(d.notes[1].minPrice, 30000);
  assert.equal(d.notes[2].logoUrl, 'https://pub.r2.dev/a.webp');
});

test('product display: discount percent and which notes apply', () => {
  assert.equal(discountPct(52097, 86828.45), 40);
  assert.equal(discountPct(100, null), 0);
  assert.equal(discountPct(100, 90), 0);
  const d = sanitizeProductDisplay({ notes: [
    { installments: 3, text: 'sin interés', place: 'both' },
    { installments: 0, text: 'Envío gratis', minPrice: 30000, place: 'product' },
    { installments: 6, text: 'off', enabled: false },
  ] });
  assert.equal(notesFor(d, 20000, 'card').length, 1);
  assert.equal(notesFor(d, 20000, 'product').length, 1, 'debajo del mínimo no aparece');
  assert.equal(notesFor(d, 40000, 'product').length, 2);
});
