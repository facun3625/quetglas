import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { saveProduct } from '../../src/app/admin/(dashboard)/productos/actions';
import { EMPTY_PRODUCT, getProductForEdit } from '../../src/app/admin/(dashboard)/productos/formData';
import { getProductsPage } from '@/lib/products';
import { getProductDetail } from '@/lib/productDetail';

async function main() {
  for (const t of ['product', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();
  await prisma.storeSettings.create({ data: { id: 'global' } });

  const base = { ...EMPTY_PRODUCT, price: 1500, stock: 4, manageStock: true };

  // Producto con SOLO un video: la galería tiene un único lugar cuya portada es un cuadro del video
  const solo = await saveProduct({
    ...base, name: 'Solo video', slug: 'solo-video',
    images: [{ url: '/api/uploads/products/portada1.webp', thumbUrl: '/api/uploads/products/portada1_thumb.webp', alt: '', videoUrl: '/api/uploads/videos/abc.mp4' }],
  });
  assert.equal(solo.ok, true);

  // Foto y video mezclados, y un video con un enlace inválido (se descarta: no se guarda nada peligroso)
  const mixto = await saveProduct({
    ...base, name: 'Foto y video', slug: 'foto-y-video',
    images: [
      { url: '/api/uploads/products/f1.webp', thumbUrl: '/api/uploads/products/f1_t.webp', alt: '' },
      { url: '/api/uploads/products/f2.webp', thumbUrl: '/api/uploads/products/f2_t.webp', alt: '', videoUrl: '/api/uploads/videos/def.webm' },
      { url: '/api/uploads/products/f3.webp', thumbUrl: null, alt: '', videoUrl: 'javascript:alert(1)' },
    ],
  });
  assert.equal(mixto.ok, true);
  if (!solo.ok || !mixto.ok) return;

  // Se guarda el video y la portada, y el enlace malo se descarta
  const rows = await prisma.productImage.findMany({ where: { productId: mixto.id }, orderBy: { sortOrder: 'asc' } });
  assert.deepEqual(rows.map((r) => r.videoUrl), [null, '/api/uploads/videos/def.webm', null]);

  // La tienda lo ve con portada (un producto solo con video no queda oculto) y avisa que tiene video
  const list = await getProductsPage({ limit: 20, offset: 0 });
  const bySlug = Object.fromEntries(list.products.map((p) => [p.slug, p]));
  assert.ok(bySlug['solo-video'], 'un producto solo con video se muestra en la tienda');
  assert.equal(bySlug['solo-video'].hasVideo, true);
  assert.equal(bySlug['solo-video'].image, '/api/uploads/products/portada1.webp', 'todo lo que usa la imagen sigue usando la portada');
  assert.equal(bySlug['foto-y-video'].hasVideo, false, 'la primera foto es una foto: el listado no marca video');

  // La ficha recibe el video de cada lugar de la galería
  const detail = await getProductDetail({ slug: 'solo-video' });
  assert.equal(detail?.images[0].videoUrl, '/api/uploads/videos/abc.mp4');
  const detail2 = await getProductDetail({ slug: 'foto-y-video' });
  assert.deepEqual(detail2?.images.map((i) => i.videoUrl), [null, '/api/uploads/videos/def.webm', null]);

  // Al volver a abrir el producto en el panel y guardarlo, el video se conserva
  const form = await getProductForEdit(solo.id);
  assert.equal(form?.images[0].videoUrl, '/api/uploads/videos/abc.mp4');
  const again = await saveProduct({ ...form!, name: 'Solo video (editado)' });
  assert.equal(again.ok, true);
  assert.equal((await prisma.productImage.findFirstOrThrow({ where: { productId: solo.id } })).videoUrl, '/api/uploads/videos/abc.mp4');

  console.log('product-video e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
