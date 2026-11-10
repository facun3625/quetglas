import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { loader } from './helpers/loader.mjs';

const { contactFromCustomer } = loader()('@/lib/orderCustomer');

test('los datos de contacto usan los nombres de las columnas del pedido (si no, Prisma rechaza el pedido entero)', () => {
  const c = contactFromCustomer({ name: 'A B', email: 'a@b.c', firstName: ' Ana ', lastName: 'Pérez', dni: '' });
  assert.deepEqual(c, { contactFirstName: 'Ana', contactLastName: 'Pérez', contactDni: null });
  // Todas las claves existen como campos de Order en el schema de Prisma
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const order = schema.match(/model Order \{[\s\S]*?\n\}/)[0];
  for (const key of Object.keys(c)) assert.match(order, new RegExp(`\\b${key}\\b`), key);
});
