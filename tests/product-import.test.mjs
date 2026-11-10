import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { parseNumber, buildPlan, checkPlan, readSheet, textToHtml, mapColumns } = loader()('@/lib/productImport/parse');

const H = ['grupo', 'sku', 'nombre', 'categorias', 'precio', 'stock', 'imagenes', 'atributo:Talle', 'atributo:Color'];
const sheet = (rows) => ({ headers: H, rows: rows.map((cells, i) => ({ row: i + 2, cells: H.map((h) => String(cells[h] ?? '')) })) });
const noExisting = { products: new Map(), variants: new Map() };
const errors = (issues) => issues.filter((i) => i.level === 'error');

test('números en formato argentino y en formato Excel', () => {
  assert.equal(parseNumber('15990'), 15990);
  assert.equal(parseNumber('15.990'), 15990);
  assert.equal(parseNumber('15.990,50'), 15990.5);
  assert.equal(parseNumber('15990,5'), 15990.5);
  assert.equal(parseNumber('15990.5'), 15990.5);
  assert.equal(parseNumber('$ 1.234.567'), 1234567);
  assert.equal(parseNumber('15,990'), 15990);
  assert.equal(parseNumber('abc'), null);
});

test('columnas: alias, atributos opcionales y desconocidas', () => {
  const cols = mapColumns(['SKU', 'Nombre', 'Categoría', 'Atributo: Tamaño', 'cualquier cosa']);
  assert.equal(cols.fields.get('sku'), 0);
  assert.equal(cols.fields.get('categorias'), 2);
  assert.deepEqual(cols.attributes.map((a) => a.name), ['Tamaño']);
  assert.deepEqual(cols.ignored, ['cualquier cosa']);
});

test('producto simple y producto con variantes', () => {
  const plan = buildPlan(sheet([
    { sku: 'A1', nombre: 'Simple', categorias: 'Higiene > Bucal | Ofertas', precio: '100', stock: '3', imagenes: 'https://x.com/a.jpg | foto.jpg' },
    { grupo: 'G', sku: 'G-S-N', nombre: 'Medias', precio: '50', 'atributo:Talle': 'S', 'atributo:Color': 'Negro' },
    { grupo: 'G', sku: 'G-M-N', precio: '50', 'atributo:Talle': 'M', 'atributo:Color': 'Negro' },
  ]));
  assert.deepEqual(errors(plan.issues), []);
  const [simple, variable] = plan.products;
  assert.equal(simple.kind, 'simple');
  assert.deepEqual(simple.categories, [['Higiene', 'Bucal'], ['Ofertas']]);
  assert.deepEqual(simple.images, [{ kind: 'url', url: 'https://x.com/a.jpg' }, { kind: 'zip', name: 'foto.jpg' }]);
  assert.equal(variable.kind, 'variable');
  assert.equal(variable.sku, 'G');
  assert.equal(variable.name, 'Medias');
  assert.deepEqual(variable.attributes, ['Talle', 'Color']);
  assert.equal(variable.variants.length, 2);
});

test('errores por fila: SKU repetido, combinación repetida, atributo faltante, precio inválido', () => {
  const plan = buildPlan(sheet([
    { sku: 'A1', nombre: 'x', precio: '10' },
    { sku: 'A1', nombre: 'otra', precio: '10' },
    { grupo: 'G', sku: 'G1', nombre: 'G', precio: '1', 'atributo:Talle': 'S' },
    { grupo: 'G', sku: 'G2', precio: '1', 'atributo:Talle': 'S' },
    { grupo: 'G', sku: 'G3', precio: '1' },
    { sku: 'B1', nombre: 'b', precio: 'caro' },
  ]));
  const msgs = errors(plan.issues).map((i) => `${i.row}:${i.message}`);
  assert.ok(msgs.some((m) => m.startsWith('3:SKU repetido')));
  assert.ok(msgs.some((m) => m.startsWith('5:Misma combinación')));
  assert.ok(msgs.some((m) => m.startsWith('6:Falta el valor de Talle')));
  assert.ok(msgs.some((m) => m.startsWith('7:Precio inválido')));
  assert.deepEqual(plan.products.map((p) => p.sku), ['A1', 'G']);
});

test('contra la base: nuevo sin precio, fila suelta de una variante, imagen que no está en el ZIP', () => {
  const plan = buildPlan(sheet([
    { sku: 'NUEVO', nombre: 'Sin precio' },
    { sku: 'EXISTE', precio: '99' }, // actualización: no hace falta nombre
    { sku: 'VAR-AJENA', nombre: 'x', precio: '1' },
    { sku: 'C1', nombre: 'c', precio: '1', imagenes: 'falta.jpg | esta.jpg' },
  ]));
  const existing = {
    products: new Map([['existe', { id: 'p1', type: 'simple', attributeSlugs: [] }]]),
    variants: new Map([['var-ajena', { id: 'v1', productSku: 'OTRO' }]]),
  };
  const checked = checkPlan(plan, existing, new Set(['esta.jpg']));
  // VAR-AJENA es una variante ya cargada: la fila suelta actualiza solo esa variante (el nombre se ignora, con aviso)
  assert.deepEqual(checked.products.map((p) => [p.sku, p.kind]), [['EXISTE', 'simple'], ['VAR-AJENA', 'variantUpdate'], ['C1', 'simple']]);
  assert.ok(checked.issues.some((i) => i.sku === 'VAR-AJENA' && i.level === 'warning'));
  assert.equal(checked.summary.create, 1);
  assert.equal(checked.summary.update, 1);
  assert.equal(checked.summary.variantsUpdate, 1);
  assert.deepEqual(checked.products[2].images, [{ kind: 'zip', name: 'esta.jpg' }]);
  assert.ok(checked.issues.some((i) => i.level === 'warning' && /falta\.jpg/.test(i.message)));
});

test('texto plano a HTML', () => {
  assert.equal(textToHtml('Hola\nchau\n\n2 < 3 & 4'), '<p>Hola<br>chau</p><p>2 &lt; 3 &amp; 4</p>');
  assert.equal(textToHtml('<p>ya es html</p>'), '<p>ya es html</p>');
});

test('la plantilla de ejemplo se lee sin errores', async () => {
  const data = await readSheet(readFileSync('public/descargas/plantilla-productos.xlsx'));
  const checked = checkPlan(buildPlan(data), noExisting, new Set(['oralb-indicator.jpg', 'cetaphil-crema-250.jpg', 'cetaphil-crema-textura.jpg', 'cetaphil-crema-453.jpg']));
  assert.deepEqual(errors(checked.issues), []);
  assert.equal(checked.summary.create, 5);
  assert.equal(checked.summary.variantsCreate, 6);
});
