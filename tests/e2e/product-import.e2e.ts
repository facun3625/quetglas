// Importación por Excel de punta a punta contra una base descartable (ver run.cjs):
//   DATABASE_URL=... node tests/e2e/run.cjs tests/e2e/product-import.e2e.ts
// Las imágenes no se descargan ni se suben: download/store son de mentira.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { buildPlan, checkPlan, readSheet, type SheetData } from '@/lib/productImport/parse';
import { loadExisting, runImport } from '@/lib/productImport/run';

let stored = 0;
const deps = {
  download: async (url: string) => Buffer.from(url),
  store: async () => ({ url: `/fake/${++stored}.webp`, thumbUrl: `/fake/${stored}-t.webp` }),
};
const zipNames = ['oralb-indicator.jpg', 'cetaphil-crema-250.jpg', 'cetaphil-crema-textura.jpg', 'cetaphil-crema-453.jpg'];
const zip = new Map(zipNames.map((n) => [n, async () => Buffer.from(n)]));

async function importSheet(sheet: SheetData) {
  const checked = checkPlan(buildPlan(sheet), await loadExisting(), new Set(zipNames));
  const job = await prisma.importJob.create({ data: { fileName: 'test.xlsx' } });
  await runImport(job.id, checked.products, checked.issues, zip, deps);
  return prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
}

async function main() {
  // Base vacía de catálogo
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.importJob.deleteMany();

  const template = await readSheet(readFileSync('public/descargas/plantilla-productos.xlsx'));

  const first = await importSheet(template);
  assert.equal(first.status, 'done', JSON.stringify(first.issues));
  const c1 = first.counters as Record<string, Record<string, number>>;
  assert.equal(c1.products.created, 5);
  assert.equal(c1.variants.created, 6);
  assert.equal(await prisma.product.count(), 5);
  assert.equal(await prisma.variant.count(), 6);

  const medias = await prisma.product.findUniqueOrThrow({
    where: { sku: 'MED-COMP' },
    include: { variants: { include: { terms: { include: { term: { include: { attribute: true } } } }, image: true } }, attributes: { include: { attribute: true } }, images: true, categories: { include: { category: { include: { parent: true } } } } },
  });
  assert.equal(medias.type, 'variable');
  assert.deepEqual(medias.attributes.map((a) => a.attribute.name).sort(), ['Color', 'Talle']);
  assert.equal(medias.images.length, 2, 'dos fotos distintas en el grupo (negro y beige)');
  const sBeige = medias.variants.find((v) => v.sku === 'MED-COMP-S-BEI')!;
  assert.equal(sBeige.stock, 0);
  assert.deepEqual(sBeige.terms.map((t) => t.term.name).sort(), ['Beige', 'S']);
  assert.equal(sBeige.image?.sourceUrl, 'https://ejemplo.com/fotos/medias-beige.jpg');
  assert.equal(medias.categories[0].category.name, 'Medias');
  assert.equal(medias.categories[0].category.parent?.name, 'Ortopedia');

  const alcohol = await prisma.product.findUniqueOrThrow({ where: { sku: 'ALG-ALC70-500' }, include: { categories: { include: { category: true } } } });
  assert.equal(alcohol.status, 'draft');
  assert.deepEqual(alcohol.categories.map((c) => c.category.name).sort(), ['Manos', 'Ofertas']);
  const lrp = await prisma.product.findUniqueOrThrow({ where: { sku: 'LRP-ANT50' }, include: { images: { orderBy: { sortOrder: 'asc' } }, tags: true } });
  assert.equal(lrp.price, 32990);
  assert.equal(lrp.compareAtPrice, 36990);
  assert.equal(lrp.featured, true);
  assert.equal(lrp.images.length, 2);
  assert.equal(lrp.tags.length, 2);
  assert.match(lrp.description ?? '', /<br>/);
  const imagesBefore = await prisma.productImage.count();
  const storedBefore = stored;

  // Reimportar el mismo archivo: no duplica productos, variantes, categorías ni imágenes
  const second = await importSheet(template);
  const c2 = second.counters as Record<string, Record<string, number>>;
  assert.equal(c2.products.created, 0);
  assert.equal(c2.products.updated, 5);
  assert.equal(c2.variants.updated, 6);
  assert.equal(await prisma.product.count(), 5);
  assert.equal(await prisma.variant.count(), 6);
  assert.equal(await prisma.productImage.count(), imagesBefore);
  assert.equal(stored, storedBefore, 'no vuelve a subir imágenes');
  assert.equal(await prisma.category.count(), 9, 'reimportar no duplica categorías');

  // Actualización mínima: solo sku + precio. Lo demás queda igual.
  const priceOnly = await importSheet({ headers: ['sku', 'precio'], rows: [{ row: 2, cells: ['LRP-ANT50', '29.990'] }, { row: 3, cells: ['CET-CREMA-453', '25000'] }] });
  assert.equal(priceOnly.status, 'done');
  const lrp2 = await prisma.product.findUniqueOrThrow({ where: { sku: 'LRP-ANT50' }, include: { images: true, categories: true } });
  assert.equal(lrp2.price, 29990);
  assert.equal(lrp2.name, lrp.name);
  assert.equal(lrp2.stock, 12);
  assert.equal(lrp2.images.length, 2);
  assert.equal(lrp2.categories.length, 1);
  // CET-CREMA-453 es una variante: sku+precio sin grupo actualiza solo esa variante
  const cet = await prisma.variant.findUniqueOrThrow({ where: { sku: "CET-CREMA-453" } });
  assert.equal(cet.price, 25000);
  assert.equal(cet.stock, 5);
  assert.ok(cet.imageId, "conserva su foto");
  assert.deepEqual(priceOnly.issues, []);

  console.log('OK importación por Excel');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
