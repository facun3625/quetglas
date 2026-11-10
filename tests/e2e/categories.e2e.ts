import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { createCategory, saveCategoryDetails, deleteCategoryAction } from '../../src/app/admin/(dashboard)/categorias/actions';

const base = { name: '', slug: '', parentId: '', sortOrder: 0, description: '', comingSoonMessage: '', imageUrl: '', seoTitle: '', seoDescription: '' };

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Product","Category" CASCADE');
  assert.equal((await createCategory({ name: ' ', parentId: '' })).ok, false);
  const a = await createCategory({ name: 'Disfraces', parentId: '' }); const aId = (a as { id: string }).id;
  const b = await createCategory({ name: 'Niños', parentId: aId }); const bId = (b as { id: string }).id;
  const c = await createCategory({ name: 'Disfraces', parentId: '' }); const cId = (c as { id: string }).id;
  assert.equal((await prisma.category.findUniqueOrThrow({ where: { id: cId } })).slug, 'disfraces-2', 'slug repetido se desambigua');
  assert.equal((await createCategory({ name: 'X', parentId: 'no-existe' })).ok, false);

  assert.equal((await saveCategoryDetails(aId, { ...base, name: 'Disfraces', parentId: aId })).ok, false);
  assert.equal((await saveCategoryDetails(aId, { ...base, name: 'Disfraces', parentId: bId })).ok, false);
  const ok = await saveCategoryDetails(bId, { ...base, name: 'Niños y niñas', slug: 'ninos-y-ninas', parentId: aId, sortOrder: 3, description: 'Para chicos', imageUrl: ' /api/uploads/products/x.webp ', seoTitle: 'T', seoDescription: 'D' });
  assert.equal(ok.ok, true);
  const row = await prisma.category.findUniqueOrThrow({ where: { id: bId } });
  assert.deepEqual([row.name, row.slug, row.sortOrder, row.imageUrl, row.seoTitle], ['Niños y niñas', 'ninos-y-ninas', 3, '/api/uploads/products/x.webp', 'T']);
  assert.equal((await saveCategoryDetails(bId, { ...base, name: 'Niños y niñas', slug: 'disfraces' })).ok, true);
  assert.notEqual((await prisma.category.findUniqueOrThrow({ where: { id: bId } })).slug, 'disfraces', 'slug tomado: se desambigua, no pisa');
  assert.equal((await saveCategoryDetails(bId, { ...base, name: '  ' })).ok, false);
  assert.equal((await saveCategoryDetails(bId, { ...base, name: 'Niños y niñas', parentId: cId })).ok, true);
  assert.equal((await prisma.category.findUniqueOrThrow({ where: { id: bId } })).parentId, cId);

  const p = await prisma.product.create({ data: { name: 'Disfraz', slug: 'disfraz', price: 1, categories: { create: [{ categoryId: cId }] } } });
  await deleteCategoryAction(cId);
  assert.equal(await prisma.category.count({ where: { id: cId } }), 0);
  assert.equal((await prisma.category.findUniqueOrThrow({ where: { id: bId } })).parentId, null, 'la hija sube al nivel superior');
  assert.equal(await prisma.product.count({ where: { id: p.id } }), 1, 'el producto no se borra');
  assert.equal(await prisma.productCategory.count({ where: { productId: p.id } }), 0);
  console.log('categories e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
