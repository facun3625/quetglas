import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { runMigration } from '@/lib/woo/migrate';
import type { WooClient } from '@/lib/woo/client';

// ---- Tienda WooCommerce simulada ----
const img = (id: number, name: string) => ({ id, src: `https://shop.test/wp-content/${name}.jpg`, alt: name });
const data: Record<string, any[]> = {
  'products/categories': [
    { id: 11, name: 'Remeras', slug: 'remeras', parent: 10, menu_order: 1, image: null },
    { id: 10, name: 'Ropa &amp; Moda', slug: 'ropa', parent: 0, menu_order: 0, description: '<p>Todo</p><script>x</script>', image: img(900, 'cat-ropa') },
  ],
  'products/attributes': [{ id: 1, name: 'Talle', slug: 'pa_talle' }],
  'products/attributes/1/terms': [{ id: 1, name: 'S', slug: 's' }, { id: 2, name: 'M', slug: 'm' }, { id: 3, name: 'L', slug: 'l' }],
  products: [
    { id: 101, name: 'Taza &amp; Mate', slug: 'taza-mate', type: 'simple', status: 'publish', sku: 'TAZA', regular_price: '2500', sale_price: '2000', price: '2000', on_sale: true, manage_stock: true, stock_quantity: 7, weight: '0.4', dimensions: { length: '10', width: '8', height: '9' }, categories: [{ id: 10 }], images: [img(1, 'taza'), img(2, 'broken-taza')], featured: true, description: '<p>Linda</p><script>alert(1)</script>' },
    { id: 102, name: 'Remera Lisa', slug: 'remera-lisa', type: 'variable', status: 'publish', sku: 'REM', categories: [{ id: 11 }], images: [img(3, 'rem-rojo'), img(4, 'rem-azul')],
      attributes: [{ id: 1, name: 'Talle', variation: true, options: ['S', 'M', 'L'] }, { id: 0, name: 'Color', variation: true, options: ['Rojo', 'Azul'] }, { id: 0, name: 'Material', variation: false, options: ['Algodón'] }], variations: [201, 202, 203, 204] },
    { id: 103, name: 'Pack', slug: 'pack', type: 'grouped', status: 'publish', images: [] },
    { id: 104, name: 'Borrador', slug: 'borrador', type: 'simple', status: 'draft', regular_price: '10', stock_status: 'outofstock', manage_stock: false, images: [] },
    { id: 105, name: 'Otro con mismo SKU', slug: 'otro', type: 'simple', status: 'publish', sku: 'TAZA', regular_price: '5', manage_stock: false, stock_status: 'instock', images: [] },
  ],
  'products/102/variations': [
    { id: 201, sku: 'REM-S-R', regular_price: '4000', manage_stock: true, stock_quantity: 3, image: img(3, 'rem-rojo'), attributes: [{ id: 1, name: 'Talle', option: 'S' }, { id: 0, name: 'Color', option: 'Rojo' }] },
    { id: 202, sku: 'REM-M-A', regular_price: '4500', sale_price: '4200', on_sale: true, manage_stock: false, stock_status: 'outofstock', attributes: [{ id: 1, name: 'Talle', option: 'M' }, { id: 0, name: 'Color', option: 'Azul' }] },
    { id: 203, sku: 'REM-ANY', regular_price: '1', attributes: [{ id: 1, name: 'Talle', option: 'L' }, { id: 0, name: 'Color', option: '' }] },
    { id: 204, sku: 'TAZA', regular_price: '4600', manage_stock: true, stock_quantity: 1, attributes: [{ id: 1, name: 'Talle', option: 'L' }, { id: 0, name: 'Color', option: 'Azul' }] },
  ],
  customers: [
    { id: 1, email: 'Ana@Example.com', first_name: 'Ana', last_name: 'Pérez', billing: { phone: '341' } },
    { id: 2, email: 'existente@example.com', first_name: 'Otro Nombre' },
    { id: 3, email: 'no-es-email', first_name: 'X' },
  ],
};

function fakeClient(): WooClient {
  const get = async (path: string, params: any = {}) => {
    const rows = data[path];
    if (!rows) throw new Error(`404 ${path}`);
    const per = Number(params.per_page ?? 50), page = Number(params.page ?? 1);
    return { data: rows.slice((page - 1) * per, page * per) as any, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / per)) };
  };
  async function* paged(path: string, params: any = {}) {
    for (let page = 1; ; page++) {
      const r = await get(path, { per_page: 2, ...params, page }); // páginas chicas para probar el paginado
      if (r.data.length) yield r.data;
      if (page >= r.totalPages) return;
    }
  }
  return { baseUrl: 'https://shop.test', get: get as any, paged: paged as any };
}

let stored = 0;
const deps = {
  download: async (url: string) => { if (url.includes('broken')) throw new Error('404'); return Buffer.from(url); },
  store: async (b: Buffer) => { stored++; const id = b.toString().split('/').pop()!.replace('.jpg', ''); return { url: `https://cdn.test/${id}.webp`, thumbUrl: `https://cdn.test/${id}-t.webp` }; },
};

async function newJob() {
  return prisma.migrationJob.create({ data: { sourceUrl: 'https://shop.test', options: { customers: true } } });
}
const counts = async () => ({
  categories: await prisma.category.count(), attributes: await prisma.attribute.count(), terms: await prisma.attributeTerm.count(),
  products: await prisma.product.count(), variants: await prisma.variant.count(), images: await prisma.productImage.count(), users: await prisma.user.count(),
});

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Category","Product","Attribute","User","MigrationJob" CASCADE');
  await prisma.user.create({ data: { email: 'existente@example.com', name: 'Nombre Original', passwordHash: 'hash-existente' } });

  // ---- 1ª corrida ----
  const job1 = await newJob();
  await runMigration(job1.id, fakeClient(), { customers: true }, deps);
  const j1 = await prisma.migrationJob.findUniqueOrThrow({ where: { id: job1.id } });
  assert.equal(j1.status, 'done', JSON.stringify(j1.issues));
  const c1 = await counts();
  console.log('corrida 1:', c1, JSON.stringify(j1.counters));

  // categorías: árbol, nombres decodificados, descripción sanitizada, imagen subida
  const ropa = await prisma.category.findFirstOrThrow({ where: { wooId: 10 } });
  const remeras = await prisma.category.findFirstOrThrow({ where: { wooId: 11 } });
  assert.equal(ropa.name, 'Ropa & Moda'); assert.equal(remeras.parentId, ropa.id);
  assert.ok(!ropa.description!.includes('<script'));
  assert.equal(ropa.imageUrl, 'https://cdn.test/cat-ropa.webp');

  // producto simple: oferta -> precio + tachado, stock, SKU, medidas, descripción limpia
  const taza = await prisma.product.findFirstOrThrow({ where: { wooId: 101 }, include: { images: { orderBy: { sortOrder: 'asc' } }, categories: true } });
  assert.equal(taza.name, 'Taza & Mate'); assert.equal(taza.price, 2000); assert.equal(taza.compareAtPrice, 2500);
  assert.equal(taza.stock, 7); assert.equal(taza.manageStock, true); assert.equal(taza.sku, 'TAZA'); assert.equal(taza.featured, true);
  assert.equal(taza.weight, 0.4); assert.equal(taza.height, 9); assert.ok(!taza.description!.includes('<script'));
  assert.equal(taza.images.length, 1, 'la imagen rota no se importa pero el producto sí');
  assert.equal(taza.categories[0].categoryId, ropa.id);

  // variable: atributos global + local, variante "any" omitida, SKU duplicado sin SKU, stock/precio por variante
  const rem = await prisma.product.findFirstOrThrow({ where: { wooId: 102 }, include: { attributes: { include: { attribute: true } }, variants: { include: { terms: { include: { term: true } }, image: true }, orderBy: { wooId: 'asc' } } } });
  assert.equal(rem.type, 'variable'); assert.equal(rem.attributes.length, 2, 'el atributo no usado para variaciones (Material) no se importa');
  assert.deepEqual(rem.attributes.map((a) => a.attribute.name).sort(), ['Color', 'Talle']);
  assert.equal(rem.variants.length, 3, 'la variación "cualquiera" (203) se omite; las otras 3 entran');
  const [v1, v2, v4] = rem.variants;
  assert.equal(v4.sku, null, 'SKU TAZA ya usado por un producto: la variante entra sin SKU'); assert.equal(v4.price, 4600);
  assert.equal(v1.sku, 'REM-S-R'); assert.equal(v1.price, 4000); assert.equal(v1.stock, 3); assert.equal(v1.manageStock, true);
  assert.deepEqual(v1.terms.map((t) => t.term.name).sort(), ['Rojo', 'S']); assert.equal(v1.image?.url, 'https://cdn.test/rem-rojo.webp');
  assert.equal(v2.price, 4200); assert.equal(v2.compareAtPrice, 4500); assert.equal(v2.stock, 0); assert.equal(v2.manageStock, true, 'agotada = stock 0 controlado');
  const talle = await prisma.attribute.findFirstOrThrow({ where: { wooId: 1 }, include: { terms: true } });
  assert.deepEqual(talle.terms.map((t) => t.name).sort(), ['L', 'M', 'S']);
  assert.equal((await prisma.attribute.findFirstOrThrow({ where: { slug: 'color' } })).wooId, null);

  // omitidos y borrador
  assert.equal(await prisma.product.count({ where: { wooId: 103 } }), 0, 'agrupado omitido');
  const draft = await prisma.product.findFirstOrThrow({ where: { wooId: 104 } });
  assert.equal(draft.status, 'draft'); assert.equal(draft.stock, 0); assert.equal(draft.manageStock, true, 'sin stock => agotado');
  assert.equal((await prisma.product.findFirstOrThrow({ where: { wooId: 105 } })).sku, null, 'SKU duplicado importado sin SKU');

  // clientes
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@example.com' } });
  assert.equal(ana.name, 'Ana Pérez'); assert.equal(ana.passwordHash, null); assert.equal(ana.wooId, 1); assert.equal(ana.phone, '341');
  const existente = await prisma.user.findUniqueOrThrow({ where: { email: 'existente@example.com' } });
  assert.equal(existente.name, 'Nombre Original'); assert.equal(existente.passwordHash, 'hash-existente'); assert.equal(existente.wooId, 2);
  assert.equal(await prisma.user.count({ where: { email: 'no-es-email' } }), 0);
  const issues = j1.issues as any[];
  assert.ok(issues.some((i) => i.entity === 'imagen'), 'se informa la imagen rota');
  assert.ok(issues.some((i) => /no soportado/.test(i.message)), 'se informa el producto agrupado');

  // ---- 2ª corrida: idempotente ----
  const storedBefore = stored;
  const job2 = await newJob();
  await runMigration(job2.id, fakeClient(), { customers: true }, deps);
  assert.equal((await prisma.migrationJob.findUniqueOrThrow({ where: { id: job2.id } })).status, 'done');
  assert.deepEqual(await counts(), c1, 'reintentar no duplica nada');
  assert.equal(stored, storedBefore, 'no vuelve a subir imágenes ya migradas');

  // ---- 3ª corrida: cambios en Woo se reflejan ----
  data.products[0].regular_price = '3000'; data.products[0].sale_price = ''; data.products[0].on_sale = false;
  data['products/102/variations'] = data['products/102/variations'].filter((v: any) => v.id !== 202);
  const job3 = await newJob();
  await runMigration(job3.id, fakeClient(), { customers: false }, deps);
  const taza2 = await prisma.product.findFirstOrThrow({ where: { wooId: 101 } });
  assert.equal(taza2.price, 3000); assert.equal(taza2.compareAtPrice, null); assert.equal(taza2.slug, taza.slug, 'el slug no cambia');
  assert.equal(await prisma.variant.count({ where: { productId: rem.id } }), 2, 'la variante borrada en Woo se elimina');

  // ---- cancelación ----
  const job4 = await newJob();
  await prisma.migrationJob.update({ where: { id: job4.id }, data: { cancelRequested: true } });
  await runMigration(job4.id, fakeClient(), { customers: true }, deps);
  assert.equal((await prisma.migrationJob.findUniqueOrThrow({ where: { id: job4.id } })).status, 'cancelled');

  // ---- error de conexión ----
  const job5 = await newJob();
  const broken: WooClient = { baseUrl: 'x', get: async () => { throw new Error('Credenciales inválidas'); }, paged: (async function* () { throw new Error('Credenciales inválidas'); }) as any };
  await runMigration(job5.id, broken, { customers: false }, deps);
  const j5 = await prisma.migrationJob.findUniqueOrThrow({ where: { id: job5.id } });
  assert.equal(j5.status, 'failed'); assert.match(JSON.stringify(j5.issues), /Credenciales/);

  await prisma.$executeRawUnsafe('TRUNCATE "Category","Product","Attribute","User","MigrationJob" CASCADE');
  console.log('WOO E2E OK');
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
