import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { cleanContactName, cleanContactPhone, parseContactRequest } = loader()('@/lib/ai/validation');
const SESSION = '3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90';

test('contacto del chat: el nombre se limpia y se valida', () => {
  assert.equal(cleanContactName('  María   José  '), 'María José');
  assert.equal(cleanContactName('Ana <script>alert(1)</script>'), 'Ana script alert(1) /script');
  assert.equal(cleanContactName('Juan\u0000\nPérez'), 'Juan Pérez');
  assert.throws(() => cleanContactName(''), /nombre/i);
  assert.throws(() => cleanContactName('A'), /nombre/i);
  assert.throws(() => cleanContactName(undefined), /nombre/i);
  assert.throws(() => cleanContactName('x'.repeat(81)), /largo/i);
});

test('contacto del chat: el teléfono tiene que parecer un teléfono', () => {
  assert.equal(cleanContactPhone('+54 9 3425 256898'), '+54 9 3425 256898');
  assert.equal(cleanContactPhone(' (0342) 15-5256898 '), '(0342) 15-5256898');
  assert.equal(cleanContactPhone('3425256898'), '3425256898');
  for (const bad of ['', 'abc', '1234567', '1'.repeat(16), '3425 25689x', '<b>3425256898</b>', 'javascript:1234567890', 12345678, null]) {
    assert.throws(() => cleanContactPhone(bad), undefined, String(bad));
  }
});

test('contacto del chat: la solicitud necesita una sesión válida', () => {
  assert.deepEqual(parseContactRequest({ sessionId: SESSION, name: 'Ana', phone: '3425256898' }), { sessionId: SESSION, name: 'Ana', phone: '3425256898' });
  assert.throws(() => parseContactRequest({ sessionId: 'no-es-un-uuid', name: 'Ana', phone: '3425256898' }), /Sesión/);
  assert.throws(() => parseContactRequest(null), /inválida/i);
  assert.throws(() => parseContactRequest({ sessionId: SESSION, name: 'Ana' }), /teléfono/i);
});
