import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getAdminProductsPage, getProductsPage } from '@/lib/products';

const names = (r: { products: { name: string }[] }) => r.products.map((p) => p.name);

async function main() {
  for (const t of ['product', 'category', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();
  await prisma.storeSettings.create({ data: { id: 'global' } });

  // Nombres mezclando mayúsculas, minúsculas, tildes y números: justo lo que la base ordena mal por bytes
  const list: [string, number][] = [
    ['Zeta', 500], ['ÁRBOL', 300], ['abeja', 300], ['Ñandú', 100], ['arbol', 300], ['Nube', 900], ['ESTRELLA', 100], ['Pico 10', 200], ['Pico 2', 200], ['Pico 1', 200],
  ];
  for (const [i, [name, price]] of list.entries()) {
    await prisma.product.create({ data: { id: `p${i}`, name, slug: `p${i}`, price, stock: 5, manageStock: true, status: 'published', images: { create: { url: `/x/${i}.webp` } } } });
  }
  const expectedAsc = ['abeja', 'arbol', 'ÁRBOL', 'ESTRELLA', 'Nube', 'Ñandú', 'Pico 1', 'Pico 2', 'Pico 10', 'Zeta'];

  // Panel: A→Z, Z→A y por defecto
  let r = await getAdminProductsPage({ limit: 50, offset: 0 });
  assert.deepEqual(names(r), expectedAsc, 'por defecto A → Z de verdad');
  assert.equal(r.total, 10);
  r = await getAdminProductsPage({ sort: 'name', dir: 'asc', limit: 50, offset: 0 });
  assert.deepEqual(names(r), expectedAsc);
  r = await getAdminProductsPage({ sort: 'name', dir: 'desc', limit: 50, offset: 0 });
  assert.deepEqual(names(r), [...expectedAsc].reverse(), 'Z → A es exactamente lo inverso');

  // Paginación del panel con cualquier tamaño: sin repetidos ni faltantes, y con total correcto
  for (const dir of ['asc', 'desc'] as const) {
    for (const size of [1, 3, 4, 7, 10]) {
      const out: string[] = [];
      for (let offset = 0; offset < 30; offset += size) {
        const page = await getAdminProductsPage({ sort: 'name', dir, limit: size, offset });
        assert.equal(page.total, 10);
        out.push(...names(page));
      }
      assert.deepEqual(out, dir === 'asc' ? expectedAsc : [...expectedAsc].reverse(), `páginas de ${size} (${dir})`);
    }
  }

  // Filtros + orden: el total y el orden respetan el filtro
  r = await getAdminProductsPage({ query: 'pico', sort: 'name', dir: 'asc', limit: 50, offset: 0 });
  assert.deepEqual(names(r), ['Pico 1', 'Pico 2', 'Pico 10']);
  r = await getAdminProductsPage({ minPrice: 300, sort: 'name', dir: 'asc', limit: 50, offset: 0 });
  assert.deepEqual(names(r), ['abeja', 'arbol', 'ÁRBOL', 'Nube', 'Zeta']);

  // Por precio: los empates se desempatan por nombre y no cambian entre páginas
  const byPrice: string[] = [];
  for (let offset = 0; offset < 10; offset += 3) byPrice.push(...names(await getAdminProductsPage({ sort: 'price', dir: 'asc', limit: 3, offset })));
  assert.equal(new Set(byPrice).size, 10, 'precio: sin repetidos entre páginas');
  assert.deepEqual(byPrice.slice(0, 2), ['ESTRELLA', 'Ñandú'], 'precio 100: desempata por nombre');

  // Tienda: mismo criterio alfabético, con paginación continua
  let shop = await getProductsPage({ limit: 50, offset: 0 });
  assert.deepEqual(names(shop), expectedAsc, 'la tienda también ordena A → Z de verdad');
  const paged: string[] = [];
  for (let offset = 0; offset < 10; offset += 4) paged.push(...names(await getProductsPage({ limit: 4, offset })));
  assert.deepEqual(paged, expectedAsc);

  console.log('products-sort e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
