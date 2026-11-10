import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getAdminProductsPage, getProductsPage } from '@/lib/products';
import { bulkProductAction, quickUpdateProduct } from '../../src/app/admin/(dashboard)/productos/actions';

const names = (r: { products: { name: string }[] }) => r.products.map((p) => p.name);

async function main() {
  for (const t of ['product', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();
  await prisma.storeSettings.create({ data: { id: 'global' } });

  const mk = (id: string, name: string, o: { manage: boolean; stock: number; variants?: { manage: boolean; stock: number }[] }) =>
    prisma.product.create({
      data: {
        id, name, slug: id, price: 100, stock: o.stock, manageStock: o.manage, status: 'published', type: o.variants ? 'variable' : 'simple',
        images: { create: { url: `/x/${id}.webp` } },
        ...(o.variants ? { variants: { create: o.variants.map((v, i) => ({ id: `${id}-v${i}`, price: 100, stock: v.stock, manageStock: v.manage, enabled: true })) } } : {}),
      },
    });
  await mk('a', 'A hay existencia', { manage: false, stock: 0 });
  await mk('b', 'B no hay existencia', { manage: true, stock: 0 });
  await mk('c', 'C con cantidad', { manage: true, stock: 7 });
  await mk('d', 'D variable con una variante disponible', { manage: true, stock: 0, variants: [{ manage: false, stock: 0 }, { manage: true, stock: 0 }] });
  await mk('e', 'E variable sin existencia', { manage: true, stock: 0, variants: [{ manage: true, stock: 0 }, { manage: true, stock: 0 }] });

  // ---- Filtro de disponibilidad (mismo criterio que la tienda)
  const list = async (o: object) => names(await getAdminProductsPage({ limit: 50, offset: 0, ...o }));
  assert.deepEqual(await list({ availability: 'in' }), ['A hay existencia', 'C con cantidad', 'D variable con una variante disponible']);
  assert.deepEqual(await list({ availability: 'out' }), ['B no hay existencia', 'E variable sin existencia']);
  assert.equal((await getAdminProductsPage({ availability: 'out', limit: 50, offset: 0 })).total, 2);
  // combinado con la búsqueda y el tipo (no se pisan las condiciones)
  assert.deepEqual(await list({ availability: 'out', query: 'variable' }), ['E variable sin existencia']);
  assert.deepEqual(await list({ availability: 'in', type: 'simple' }), ['A hay existencia', 'C con cantidad']);
  assert.deepEqual(await list({ availability: 'in', query: 'zzz' }), []);

  // ---- Edición en el lugar
  assert.deepEqual(await quickUpdateProduct('a', { stockMode: 'unavailable' }), { ok: true });
  let a = await prisma.product.findUniqueOrThrow({ where: { id: 'a' } });
  assert.deepEqual([a.manageStock, a.stock], [true, 0], 'No hay existencia = controlado con 0');
  assert.deepEqual(await quickUpdateProduct('a', { stockMode: 'available' }), { ok: true });
  a = await prisma.product.findUniqueOrThrow({ where: { id: 'a' } });
  assert.deepEqual([a.manageStock, a.stock], [false, 0], 'Hay existencia = sin control de cantidad');
  assert.deepEqual(await quickUpdateProduct('a', { stockMode: 'tracked', stock: 12 }), { ok: true });
  a = await prisma.product.findUniqueOrThrow({ where: { id: 'a' } });
  assert.deepEqual([a.manageStock, a.stock], [true, 12]);
  // cambiar solo la cantidad de uno que ya la controla sigue funcionando como antes
  assert.deepEqual(await quickUpdateProduct('a', { stock: 5 }), { ok: true });
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: 'a' } })).stock, 5);
  // inválidos
  assert.equal((await quickUpdateProduct('a', { stockMode: 'otro' as never })).ok, false);
  assert.equal((await quickUpdateProduct('a', { stockMode: 'tracked', stock: -1 })).ok, false);
  assert.equal((await quickUpdateProduct('a', { stockMode: 'tracked', stock: 2.5 })).ok, false);
  assert.equal((await quickUpdateProduct('d', { stockMode: 'available' })).ok, false, 'los productos con variantes se editan por variante');
  a = await prisma.product.findUniqueOrThrow({ where: { id: 'a' } });
  assert.deepEqual([a.manageStock, a.stock], [true, 5], 'lo inválido no cambia nada');

  // ---- Acción masiva: también alcanza a las variantes
  let r = await bulkProductAction(['b', 'd', 'e'], { type: 'stockMode', mode: 'available' });
  assert.deepEqual([r.ok, r.affected], [true, 3]);
  for (const v of await prisma.variant.findMany({ where: { productId: { in: ['d', 'e'] } } })) assert.equal(v.manageStock, false, `variante ${v.id}`);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: 'b' } })).manageStock, false);
  assert.deepEqual(await list({ availability: 'out' }), [], 'ahora todo tiene existencia');

  r = await bulkProductAction(['c', 'e'], { type: 'stockMode', mode: 'unavailable' });
  assert.deepEqual([r.ok, r.affected], [true, 2]);
  assert.deepEqual(await list({ availability: 'out' }), ['C con cantidad', 'E variable sin existencia']);
  const c = await prisma.product.findUniqueOrThrow({ where: { id: 'c' } });
  assert.deepEqual([c.manageStock, c.stock], [true, 0], 'sin existencia: la cantidad queda en 0');
  for (const v of await prisma.variant.findMany({ where: { productId: 'e' } })) assert.deepEqual([v.manageStock, v.stock], [true, 0]);
  assert.equal((await bulkProductAction(['c'], { type: 'stockMode', mode: 'otra' as never })).ok, false);
  assert.equal((await bulkProductAction([], { type: 'stockMode', mode: 'available' })).ok, false);

  // ---- La tienda lo respeta: lo que no tiene existencia queda al final y figura sin stock
  const shop = await getProductsPage({ limit: 50, offset: 0 });
  assert.deepEqual(names(shop).slice(-2), ['C con cantidad', 'E variable sin existencia']);
  assert.equal(shop.products.find((p) => p.name.startsWith('C con'))!.stock, 0);
  assert.ok(shop.products.find((p) => p.name.startsWith('A'))!.stock > 0);

  console.log('stock-mode e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
