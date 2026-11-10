import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { stockModeOf, stockFieldsFor, STOCK_MODE_LABEL } = loader()('@/lib/stockMode');

test('existencia: lo que ya está cargado cae en uno de los tres estados', () => {
  // Productos migrados: "en stock" sin control de cantidad → hay existencia; "agotado" → stock 0 controlado
  assert.equal(stockModeOf({ manageStock: false, stock: 0 }), 'available');
  assert.equal(stockModeOf({ manageStock: false, stock: 999 }), 'available', 'sin control, la cantidad guardada no importa');
  assert.equal(stockModeOf({ manageStock: true, stock: 0 }), 'unavailable');
  assert.equal(stockModeOf({ manageStock: true, stock: -3 }), 'unavailable');
  assert.equal(stockModeOf({ manageStock: true, stock: 12 }), 'tracked');
});

test('existencia: qué se guarda para cada estado', () => {
  assert.deepEqual(stockFieldsFor('available'), { manageStock: false, stock: 0 });
  assert.deepEqual(stockFieldsFor('unavailable'), { manageStock: true, stock: 0 });
  assert.deepEqual(stockFieldsFor('tracked', 8), { manageStock: true, stock: 8 });
  assert.deepEqual(stockFieldsFor('tracked', 3.9), { manageStock: true, stock: 3 }, 'la cantidad es entera');
  assert.deepEqual(stockFieldsFor('tracked', -5), { manageStock: true, stock: 0 }, 'nunca negativa');
  assert.deepEqual(stockFieldsFor('tracked', NaN), { manageStock: true, stock: 0 });
  assert.deepEqual(Object.keys(STOCK_MODE_LABEL).sort(), ['available', 'tracked', 'unavailable']);
});

test('existencia: ida y vuelta entre estados', () => {
  for (const mode of ['available', 'unavailable']) assert.equal(stockModeOf(stockFieldsFor(mode)), mode);
  assert.equal(stockModeOf(stockFieldsFor('tracked', 4)), 'tracked');
  assert.equal(stockModeOf(stockFieldsFor('tracked', 0)), 'unavailable', 'controlar cantidad con 0 unidades = sin existencia');
});
