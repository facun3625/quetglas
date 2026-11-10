import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { compareNames, compareByName } = loader()('@/lib/sortNames');

test('orden alfabético: sin distinguir mayúsculas ni tildes', () => {
  const names = ['Zeta', 'ÁRBOL', 'abeja', 'Ñandú', 'arbol', 'Nube', 'Éxito', 'ESTRELLA', 'alfa'];
  assert.deepEqual([...names].sort(compareNames), ['abeja', 'alfa', 'arbol', 'ÁRBOL', 'ESTRELLA', 'Éxito', 'Nube', 'Ñandú', 'Zeta']);
});

test('orden alfabético: los números se ordenan como números', () => {
  assert.deepEqual(['Pico 10', 'Pico 2', 'Pico 1', 'Pico 20'].sort(compareNames), ['Pico 1', 'Pico 2', 'Pico 10', 'Pico 20']);
  assert.deepEqual(['Vela 100 g', 'Vela 20 g', 'vela 3 g'].sort(compareNames), ['vela 3 g', 'Vela 20 g', 'Vela 100 g']);
});

test('orden alfabético: nombres iguales se desempatan por id (la paginación no repite ni saltea)', () => {
  const items = [{ id: 'b', name: 'Pico' }, { id: 'a', name: 'pico' }, { id: 'c', name: 'PICO' }, { id: 'd', name: 'Abeja' }];
  const once = [...items].sort(compareByName).map((i) => i.id);
  const again = [...items].reverse().sort(compareByName).map((i) => i.id);
  assert.deepEqual(once, again, 'el resultado no depende del orden de entrada');
  assert.equal(once[0], 'd');
  assert.equal(new Set(once).size, 4);
});
