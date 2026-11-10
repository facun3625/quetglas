import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getProductsPage } from '@/lib/products';

const names = (r: { products: { name: string }[] }) => r.products.map((p) => p.name);

async function pages(opts: Parameters<typeof getProductsPage>[0], size: number) {
  const out: string[] = [];
  let total = 0;
  for (let offset = 0; offset < 50; offset += size) {
    const r = await getProductsPage({ ...opts, limit: size, offset });
    total = r.total;
    if (r.products.length === 0) break;
    out.push(...names(r));
  }
  return { out, total };
}

async function main() {
  for (const t of ['product', 'category', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();

  await prisma.category.createMany({
    data: [
      { id: 'cA', name: 'Alfa', slug: 'alfa' },
      { id: 'cB', name: 'Beta', slug: 'beta' },
      { id: 'cC', name: 'Gama', slug: 'gama' },
    ],
  });
  await prisma.category.create({ data: { id: 'cA1', name: 'Alfa 1', slug: 'alfa-1', parentId: 'cA' } });

  const mk = async (id: string, name: string, o: { cat?: string; stock?: number; manage?: boolean; variants?: number[] }) =>
    prisma.product.create({
      data: {
        id, name, slug: id, price: 100, stock: o.stock ?? 0, manageStock: o.manage ?? true, status: 'published',
        type: o.variants ? 'variable' : 'simple',
        images: { create: { url: `/x/${id}.webp` } },
        ...(o.cat ? { categories: { create: { categoryId: o.cat } } } : {}),
        ...(o.variants ? { variants: { create: o.variants.map((st, i) => ({ id: `${id}-v${i}`, price: 100, stock: st, manageStock: true, enabled: true })) } } : {}),
      },
    });

  await mk('p1', 'Zeta', { cat: 'cC', stock: 5 });
  await mk('p2', 'Alfa prod', { cat: 'cA', stock: 0 });
  await mk('p3', 'Beta prod', { cat: 'cB', stock: 3 });
  await mk('p4', 'Alfa hijo', { cat: 'cA1', stock: 2 });
  await mk('p5', 'Aaa sin cat', { stock: 1 });
  await mk('p6', 'Variable', { cat: 'cB', variants: [0, 4] });
  await mk('p7', 'Variable agotado', { cat: 'cC', variants: [0, 0] });
  await mk('p8', 'Sin control', { stock: 0, manage: false });
  await prisma.storeSettings.create({ data: { id: 'global', hideOutOfStock: false } });

  // Sin categorías prioritarias: lo que tiene stock primero (por nombre) y al final lo agotado
  let r = await getProductsPage({ limit: 20, offset: 0 });
  assert.deepEqual(names(r), ['Aaa sin cat', 'Alfa hijo', 'Beta prod', 'Sin control', 'Variable', 'Zeta', 'Alfa prod', 'Variable agotado']);
  assert.equal(r.total, 8);

  // Con categorías prioritarias [Beta, Alfa]: cada grupo en orden, subcategorías incluidas, y los agotados al final
  const prio = ['cB', 'cA'];
  const expected = ['Beta prod', 'Variable', 'Alfa hijo', 'Aaa sin cat', 'Sin control', 'Zeta', 'Alfa prod', 'Variable agotado'];
  r = await getProductsPage({ limit: 20, offset: 0, priorityCategoryIds: prio });
  assert.deepEqual(names(r), expected);
  assert.equal(r.total, 8);

  // La paginación es continua: sin repetidos ni faltantes, con cualquier tamaño de página
  for (const size of [1, 2, 3, 5, 7]) {
    const p = await pages({ priorityCategoryIds: prio, limit: size, offset: 0 }, size);
    assert.deepEqual(p.out, expected, `páginas de ${size}`);
    assert.equal(p.total, 8);
  }

  // Una categoría prioritaria que es subcategoría de otra no repite productos
  r = await getProductsPage({ limit: 20, offset: 0, priorityCategoryIds: ['cA1', 'cA'] });
  assert.deepEqual(names(r), ['Alfa hijo', 'Aaa sin cat', 'Beta prod', 'Sin control', 'Variable', 'Zeta', 'Alfa prod', 'Variable agotado']);
  assert.equal(new Set(names(r)).size, 8, 'sin productos repetidos');

  // Dentro de una categoría: también con stock primero
  r = await getProductsPage({ categoryId: 'cB', limit: 20, offset: 0 });
  assert.deepEqual(names(r), ['Beta prod', 'Variable']);
  r = await getProductsPage({ categoryId: 'cA', limit: 20, offset: 0 });
  assert.deepEqual(names(r), ['Alfa hijo', 'Alfa prod'], 'la subcategoría entra y el agotado va al final');

  // Búsqueda: mismo criterio
  r = await getProductsPage({ query: 'a', limit: 20, offset: 0 });
  assert.equal(names(r).at(-1), 'Variable agotado');

  // Ocultar sin stock: desaparecen los agotados y el total los descuenta
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { hideOutOfStock: true } });
  r = await getProductsPage({ limit: 20, offset: 0, priorityCategoryIds: prio });
  assert.deepEqual(names(r), ['Beta prod', 'Variable', 'Alfa hijo', 'Aaa sin cat', 'Sin control', 'Zeta']);
  assert.equal(r.total, 6);
  const p2 = await pages({ priorityCategoryIds: prio, limit: 4, offset: 0 }, 4);
  assert.deepEqual(p2.out, names(r));

  console.log('shop-order e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
