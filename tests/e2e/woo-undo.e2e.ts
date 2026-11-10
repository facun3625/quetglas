import assert from 'node:assert/strict';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { previewUndo, undoMigration } from '@/lib/woo/undo';

const dir = path.join(process.cwd(), 'public', 'uploads', 'products');
const exists = (f: string) => access(path.join(dir, f)).then(() => true, () => false);

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Product","Category","Attribute","Tag","User","MigrationJob","Order","StoreSettings" CASCADE');
  delete process.env.R2_ACCOUNT_ID;
  await mkdir(dir, { recursive: true });
  for (const f of ['e2e-mig-a.webp', 'e2e-mig-a-thumb.webp', 'e2e-mano.webp', 'e2e-cat.webp']) await writeFile(path.join(dir, f), 'x');

  // Lo migrado (con wooId) y lo cargado a mano
  const catMig = await prisma.category.create({ data: { name: 'Disfraces', slug: 'disfraces', wooId: 11, imageUrl: '/api/uploads/products/e2e-cat.webp' } });
  const catSub = await prisma.category.create({ data: { name: 'Niños', slug: 'ninos', wooId: 12, parentId: catMig.id } });
  const catMano = await prisma.category.create({ data: { name: 'Hogar', slug: 'hogar' } });
  const attrMig = await prisma.attribute.create({ data: { name: 'Talle', slug: 'talle', wooId: 5 } });
  const attrHuerfano = await prisma.attribute.create({ data: { name: 'Color', slug: 'color' } }); // creado por la migración sin wooId
  const attrMano = await prisma.attribute.create({ data: { name: 'Material', slug: 'material' } });
  const tagHuerfana = await prisma.tag.create({ data: { name: 'verano', slug: 'verano' } });
  const tagMano = await prisma.tag.create({ data: { name: 'regalo', slug: 'regalo' } });
  const pMig = await prisma.product.create({ data: {
    name: 'Disfraz', slug: 'disfraz', price: 100, wooId: 100,
    categories: { create: [{ categoryId: catSub.id }] },
    images: { create: [{ url: '/api/uploads/products/e2e-mig-a.webp', thumbUrl: '/api/uploads/products/e2e-mig-a-thumb.webp' }] },
  } });
  await prisma.productAttribute.createMany({ data: [{ productId: pMig.id, attributeId: attrMig.id }, { productId: pMig.id, attributeId: attrHuerfano.id }] as never });
  await prisma.productTag.create({ data: { productId: pMig.id, tagId: tagHuerfana.id } });
  const pMano = await prisma.product.create({ data: { name: 'Taza', slug: 'taza', price: 50, categories: { create: [{ categoryId: catMano.id }] }, images: { create: [{ url: '/api/uploads/products/e2e-mano.webp' }] } } });
  await prisma.productTag.create({ data: { productId: pMano.id, tagId: tagMano.id } });
  await prisma.productAttribute.create({ data: { productId: pMano.id, attributeId: attrMano.id } as never });

  // Clientes: uno migrado sin compras, uno migrado con compras, uno a mano
  const uLibre = await prisma.user.create({ data: { email: 'libre@example.com', wooId: 1 } });
  const uCompro = await prisma.user.create({ data: { email: 'compro@example.com', wooId: 2 } });
  await prisma.user.create({ data: { email: 'mano@example.com' } });
  await prisma.order.create({ data: { userId: uCompro.id, customerName: 'C', customerEmail: 'compro@example.com', subtotal: 100, total: 100, paymentMethod: 'transferencia', currency: 'ARS', items: { create: [{ productId: pMig.id, name: 'Disfraz', price: 100, quantity: 1 }] } } });
  await prisma.migrationJob.create({ data: { sourceUrl: 'https://old.example.com', options: {} } });

  const pre = await previewUndo();
  assert.deepEqual([pre.products, pre.images, pre.categories, pre.attributes, pre.customersDeletable, pre.customersKept, pre.orderItemsAffected, pre.jobs], [1, 1, 2, 1, 1, 1, 1, 1]);

  const res = await undoMigration({ customers: true });
  assert.equal(res.filesDeleted, 3); assert.equal(res.filesFailed, 0);

  // Se fue lo migrado…
  assert.equal(await prisma.product.count({ where: { wooId: { not: null } } }), 0);
  assert.equal(await prisma.category.count({ where: { wooId: { not: null } } }), 0);
  assert.equal(await prisma.attribute.count({ where: { wooId: { not: null } } }), 0);
  assert.equal(await prisma.attribute.count({ where: { id: attrHuerfano.id } }), 0, 'atributo que solo usaba la migración');
  assert.equal(await prisma.tag.count({ where: { id: tagHuerfana.id } }), 0, 'etiqueta que solo usaba la migración');
  assert.equal(await prisma.migrationJob.count(), 0);
  assert.equal(await prisma.user.count({ where: { id: uLibre.id } }), 0, 'cliente migrado sin compras');
  assert.equal(await exists('e2e-mig-a.webp') || await exists('e2e-mig-a-thumb.webp') || await exists('e2e-cat.webp'), false, 'archivos borrados');
  // …y lo demás sigue
  assert.equal(await prisma.product.count({ where: { id: pMano.id } }), 1);
  assert.equal(await prisma.category.count({ where: { id: catMano.id } }), 1);
  assert.equal(await prisma.attribute.count({ where: { id: attrMano.id } }), 1);
  assert.equal(await prisma.tag.count({ where: { id: tagMano.id } }), 1);
  assert.equal(await exists('e2e-mano.webp'), true, 'archivo de un producto cargado a mano');
  assert.equal(await prisma.user.count({ where: { email: 'compro@example.com' } }), 1, 'cliente migrado que ya compró se conserva');
  assert.equal(await prisma.user.count({ where: { email: 'mano@example.com' } }), 1);
  const order = await prisma.order.findFirstOrThrow({ include: { items: true } });
  assert.equal(order.items.length, 1); assert.equal(order.items[0].productId, null, 'el pedido conserva su línea, sin enlace al producto');
  console.log('woo undo e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
