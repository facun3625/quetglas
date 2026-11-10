import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import * as actions from '@/app/admin/(dashboard)/productos/actions';
import { getProductsPage, getRelatedProducts, getOfferProducts, getFeaturedProducts } from '@/lib/products';
import { getCheckoutItems } from '@/lib/checkout';
import { getProductDetail } from '@/lib/productDetail';
import { getCustomerRows, getSegmentMembers, getSegmentEmails } from '@/lib/customers';
import { adjustUserPoints } from '@/app/admin/(dashboard)/usuarios/actions';
import { validateCoupon, registerCouponUse } from '@/lib/coupons';
import { cancelOrder } from '@/lib/stock';

const HOUR = 3600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR).toISOString();
const base = {
  name: 'Taza', slug: '', sku: 'TAZA', type: 'simple' as const, status: 'published' as const, shortDescription: '', description: '', videoUrl: '',
  price: 1000, compareAtPrice: null, stock: 10, manageStock: true, weight: null, width: null, height: null, length: null, featured: false,
  costPrice: 400, publishAt: '', unpublishAt: '', promoPrice: null, promoStartsAt: '', promoEndsAt: '', tags: [] as string[], relatedIds: [] as string[],
  seoTitle: '', seoDescription: '', categoryIds: [] as string[], images: [{ url: 'https://x.test/a.webp', thumbUrl: null, alt: '' }], attributeIds: [], variants: [],
};

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Category","Product","Attribute","Tag","User","Coupon","CustomerSegment" CASCADE');

  // ---- categorías y producto con promo vigente + etiquetas + recomendados
  const cat = await prisma.category.create({ data: { name: 'Hogar', slug: 'hogar' } });
  const a = await actions.saveProduct({ ...base, categoryIds: [cat.id], tags: ['Regalo', 'nuevo', 'regalo'], promoPrice: 800, promoStartsAt: iso(-24), promoEndsAt: iso(24), featured: true });
  assert.equal(a.ok, true, JSON.stringify(a));
  const aId = (a as { id: string }).id;
  const prodA = await prisma.product.findUniqueOrThrow({ where: { id: aId }, include: { tags: { include: { tag: true } } } });
  assert.deepEqual(prodA.tags.map((t) => t.tag.slug).sort(), ['nuevo', 'regalo'], 'etiquetas sin duplicados');
  assert.equal(prodA.costPrice, 400);

  // validaciones nuevas
  assert.equal((await actions.saveProduct({ ...base, sku: 'X1', promoPrice: 1200 })).ok, false, 'promo mayor al precio');
  assert.equal((await actions.saveProduct({ ...base, sku: 'X2', promoPrice: 500, promoStartsAt: iso(10), promoEndsAt: iso(5) })).ok, false, 'fin antes del inicio');
  assert.equal((await actions.saveProduct({ ...base, sku: 'X3', publishAt: iso(10), unpublishAt: iso(5) })).ok, false, 'despublica antes de publicar');

  // ---- precio efectivo en listado, ficha y CHECKOUT
  const list = await getProductsPage({ limit: 10, offset: 0 });
  const itemA = list.products.find((p) => p.id === aId)!;
  assert.equal(itemA.price, 800); assert.equal(itemA.compareAtPrice, 1000); assert.equal(itemA.onSale, true);
  const detail = await getProductDetail({ slug: prodA.slug });
  assert.equal(detail!.price, 800); assert.equal(detail!.onPromo, true); assert.deepEqual(detail!.tags.map((t) => t.slug).sort(), ['nuevo', 'regalo']);
  const [line] = await getCheckoutItems([{ productId: aId, quantity: 1 }]);
  assert.equal(line.price, 800, 'el checkout cobra el precio promocional vigente');
  assert.equal((await getOfferProducts()).some((p) => p.id === aId), true);
  assert.equal((await getFeaturedProducts()).some((p) => p.id === aId), true);

  // promo vencida => vuelve al precio normal en todos lados
  await prisma.product.update({ where: { id: aId }, data: { promoEndsAt: new Date(Date.now() - HOUR) } });
  assert.equal((await getCheckoutItems([{ productId: aId, quantity: 1 }]))[0].price, 1000);
  assert.equal((await getOfferProducts()).some((p) => p.id === aId), false, 'promo vencida no es oferta');
  assert.equal((await getProductsPage({ limit: 10, offset: 0, onlyOffers: true })).total, 0);

  // ---- visibilidad programada
  const b = await actions.saveProduct({ ...base, name: 'Jarra', sku: 'JARRA', publishAt: iso(48), categoryIds: [cat.id] });
  const bId = (b as { id: string }).id;
  assert.equal((await getProductsPage({ limit: 10, offset: 0 })).products.some((p) => p.id === bId), false, 'aún no publicado');
  await assert.rejects(getCheckoutItems([{ productId: bId, quantity: 1 }]), /ya no está disponible/);
  assert.equal(await getProductDetail({ slug: 'jarra' }), null);
  await prisma.product.update({ where: { id: bId }, data: { publishAt: new Date(Date.now() - HOUR) } });
  assert.equal((await getProductsPage({ limit: 10, offset: 0 })).products.some((p) => p.id === bId), true, 'ya publicado');
  await prisma.product.update({ where: { id: bId }, data: { unpublishAt: new Date(Date.now() - 1000) } });
  assert.equal((await getProductsPage({ limit: 10, offset: 0 })).products.some((p) => p.id === bId), false, 'ya vencido');

  // ---- etiquetas: filtro en tienda; recomendados manuales y por categoría
  assert.equal((await getProductsPage({ limit: 10, offset: 0, tagSlug: 'regalo' })).total, 1);
  assert.equal((await getProductsPage({ limit: 10, offset: 0, tagSlug: 'inexistente' })).total, 0);
  const c = await actions.saveProduct({ ...base, name: 'Plato', sku: 'PLATO', categoryIds: [cat.id] });
  const cId = (c as { id: string }).id;
  assert.deepEqual((await getRelatedProducts(aId, [cat.id])).map((p) => p.id), [cId], 'sin manuales: misma categoría');
  await actions.saveProduct({ ...base, id: aId, categoryIds: [cat.id], tags: ['regalo'], relatedIds: [cId, aId, 'no-existe'], promoPrice: 800, promoEndsAt: iso(24) });
  assert.deepEqual((await prisma.productRelation.findMany({ where: { productId: aId } })).map((r) => r.relatedId), [cId], 'recomendados: sin sí mismo ni inexistentes');
  assert.deepEqual((await getRelatedProducts(aId, [])).map((p) => p.id), [cId]);

  // ---- edición rápida
  assert.equal((await actions.quickUpdateProduct(cId, { price: 1500, stock: 3 })).ok, true);
  assert.equal((await actions.quickUpdateProduct(cId, { price: -1 })).ok, false);
  assert.equal((await actions.quickUpdateProduct(aId, { price: 700 })).ok, false, 'no baja el precio por debajo de la promo');
  const cAfter = await prisma.product.findUniqueOrThrow({ where: { id: cId } });
  assert.equal(cAfter.price, 1500); assert.equal(cAfter.stock, 3);

  // ---- acciones masivas
  assert.equal((await actions.bulkProductAction([aId, cId], { type: 'draft' })).affected, 2);
  assert.equal((await prisma.product.count({ where: { status: 'draft' } })), 2);
  await actions.bulkProductAction([aId, cId], { type: 'publish' });
  await actions.bulkProductAction([cId], { type: 'feature', value: true });
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: cId } })).featured, true);
  const cat2 = await prisma.category.create({ data: { name: 'Cocina', slug: 'cocina' } });
  await actions.bulkProductAction([aId, cId], { type: 'addCategory', categoryId: cat2.id });
  await actions.bulkProductAction([aId, cId], { type: 'addCategory', categoryId: cat2.id }); // idempotente
  assert.equal(await prisma.productCategory.count({ where: { categoryId: cat2.id } }), 2);
  await actions.bulkProductAction([aId], { type: 'removeCategory', categoryId: cat2.id });
  assert.equal(await prisma.productCategory.count({ where: { categoryId: cat2.id } }), 1);
  assert.equal((await actions.bulkProductAction([cId], { type: 'adjustPrice', percent: 10 })).affected, 1);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: cId } })).price, 1650);
  assert.equal((await actions.bulkProductAction([cId], { type: 'adjustPrice', percent: -95 })).ok, false);
  assert.equal((await actions.bulkProductAction([], { type: 'publish' })).ok, false);

  // ---- duplicar
  const dup = await actions.duplicateProduct(aId);
  assert.equal(dup.ok, true);
  const copy = await prisma.product.findUniqueOrThrow({ where: { id: dup.id! }, include: { images: true, tags: true, categories: true } });
  assert.equal(copy.status, 'draft'); assert.equal(copy.sku, null); assert.equal(copy.featured, false); assert.match(copy.name, /^Copia de /);
  assert.equal(copy.images.length, 1); assert.equal(copy.tags.length, 1); assert.equal(copy.categories.length, 1); assert.notEqual(copy.slug, prodA.slug);

  // ---- borrar con acción masiva
  assert.equal((await actions.bulkProductAction([dup.id!], { type: 'delete' })).affected, 1);

  // ================= CLIENTES =================
  const mk = (email: string, over = {}) => prisma.user.create({ data: { email, name: email.split('@')[0], ...over } });
  const day = (n: number) => new Date(Date.now() - n * 24 * HOUR);
  const ana = await mk('ana@x.com', { createdAt: day(200), points: 150 });
  const beto = await mk('beto@x.com', { createdAt: day(5) });
  const caro = await mk('caro@x.com', { createdAt: day(60) });
  const coupon = await prisma.coupon.create({ data: { code: 'VERANO', discountType: 'percentage', discountValue: 10 } });
  const order = (over: Record<string, unknown>) => prisma.order.create({ data: { customerName: 'x', customerEmail: 'z@z.com', subtotal: 100, total: 100, paymentMethod: 'transferencia', ...over } as never });
  await order({ userId: ana.id, customerEmail: 'ana@x.com', status: 'delivered', total: 3000, createdAt: day(100) });
  await order({ userId: ana.id, customerEmail: 'ana@x.com', status: 'confirmed', total: 2000, createdAt: day(50), couponId: coupon.id });
  await order({ customerEmail: 'ANA@x.com', status: 'delivered', total: 500, createdAt: day(10) }); // invitado, mismo email
  await order({ userId: ana.id, customerEmail: 'ana@x.com', status: 'pending', total: 9999, createdAt: day(1) }); // no pagado: no cuenta
  await order({ userId: ana.id, customerEmail: 'ana@x.com', status: 'cancelled', total: 8888, createdAt: day(1) }); // cancelado: no cuenta
  await order({ userId: caro.id, customerEmail: 'caro@x.com', status: 'delivered', total: 700, createdAt: day(3) });

  const rows = await getCustomerRows();
  const rowOf = (id: string) => rows.find((r) => r.id === id)!;
  assert.equal(rowOf(ana.id).stats.orders, 3, 'cuenta solo pedidos pagados + el del invitado con su email');
  assert.equal(rowOf(ana.id).stats.spent, 5500);
  assert.deepEqual(rowOf(ana.id).stats.couponIds, [coupon.id]);
  assert.equal(rowOf(beto.id).stats.orders, 0);

  const seg = async (type: string, params: object) => (await getSegmentMembers({ type: type as never, params }, rows)).map((r) => r.email).sort();
  assert.deepEqual(await seg('frequent', { minOrders: 3, days: 0 }), ['ana@x.com']);
  assert.deepEqual(await seg('frequent', { minOrders: 3, days: 30 }), []);
  assert.deepEqual(await seg('high_spend', { minSpent: 5000 }), ['ana@x.com']);
  assert.deepEqual(await seg('new_customers', { days: 30 }), ['beto@x.com']);
  assert.deepEqual(await seg('never_purchased', { days: 0 }), ['beto@x.com']);
  assert.deepEqual(await seg('inactive', { days: 2 }), ['ana@x.com', 'caro@x.com']);
  assert.deepEqual(await seg('with_points', { minPoints: 100 }), ['ana@x.com']);
  assert.deepEqual(await seg('from_coupon', { couponId: coupon.id }), ['ana@x.com']);

  // emails para campañas (segmentos activos, sin duplicados)
  const s1 = await prisma.customerSegment.create({ data: { name: 'Frecuentes', type: 'frequent', params: { minOrders: 3 } } });
  const s2 = await prisma.customerSegment.create({ data: { name: 'Con puntos', type: 'with_points', params: { minPoints: 1 } } });
  const s3 = await prisma.customerSegment.create({ data: { name: 'Apagado', type: 'new_customers', params: { days: 30 }, enabled: false } });
  assert.deepEqual((await getSegmentEmails([s1.id, s2.id, s3.id])).sort(), ['ana@x.com'], 'sin duplicados y sin segmentos apagados');

  // ---- ajuste manual de puntos
  assert.equal((await adjustUserPoints(ana.id, 50, 'Compensación')).ok, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: ana.id } })).points, 200);
  assert.equal((await adjustUserPoints(ana.id, -500, 'Corrección')).ok, false, 'no deja el saldo negativo');
  assert.equal((await adjustUserPoints(ana.id, 0, 'x')).ok, false);
  assert.equal((await adjustUserPoints(ana.id, 5, '  ')).ok, false);
  assert.equal(await prisma.pointTransaction.count({ where: { userId: ana.id } }), 1);

  // ================= CUPONES: vigencia y uso único por cliente =================
  const items = [{ productId: aId, quantity: 1 }];
  const ctx = { subtotal: 1000, items, paymentMethod: 'transferencia' };
  const future = await prisma.coupon.create({ data: { code: 'FUTURO', discountType: 'percentage', discountValue: 10, startsAt: new Date(Date.now() + 48 * HOUR) } });
  const r1 = await validateCoupon('futuro', ctx);
  assert.equal(r1.ok, false); assert.match((r1 as { error: string }).error, /todavía no está vigente/);
  await prisma.coupon.update({ where: { id: future.id }, data: { startsAt: new Date(Date.now() - HOUR) } });
  assert.equal((await validateCoupon('FUTURO', ctx)).ok, true);

  const once = await prisma.coupon.create({ data: { code: 'UNAVEZ', discountType: 'fixed', discountValue: 100, oneUsePerCustomer: true } });
  const noEmail = await validateCoupon('UNAVEZ', ctx);
  assert.equal(noEmail.ok, false, 'sin cuenta ni email no se puede verificar el uso único');
  assert.equal((await validateCoupon('UNAVEZ', { ...ctx, customerEmail: 'Nuevo@X.com' })).ok, true);

  const ord = await prisma.order.create({ data: { customerName: 'Nuevo', customerEmail: 'nuevo@x.com', subtotal: 1000, total: 900, couponId: once.id, couponDiscount: 100, paymentMethod: 'transferencia', stockDeductedAt: new Date() } });
  await registerCouponUse(once.id, { userId: null, email: 'nuevo@x.com', orderId: ord.id });
  assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { id: once.id } })).usedCount, 1);
  const again = await validateCoupon('UNAVEZ', { ...ctx, customerEmail: 'NUEVO@x.com' });
  assert.equal(again.ok, false); assert.match((again as { error: string }).error, /Ya usaste/);
  assert.equal((await validateCoupon('UNAVEZ', { ...ctx, customerEmail: 'otro@x.com' })).ok, true, 'otro cliente sí puede');
  // con cuenta: si ya lo usó como invitado con el mismo email, también queda bloqueado
  assert.equal((await validateCoupon('UNAVEZ', { ...ctx, userId: ana.id, customerEmail: 'nuevo@x.com' })).ok, false);

  // al cancelar el pedido el cupón queda libre otra vez
  await cancelOrder(ord.id);
  assert.equal((await prisma.coupon.findUniqueOrThrow({ where: { id: once.id } })).usedCount, 0);
  assert.equal(await prisma.couponRedemption.count({ where: { couponId: once.id } }), 0);
  assert.equal((await validateCoupon('UNAVEZ', { ...ctx, customerEmail: 'nuevo@x.com' })).ok, true);

  await prisma.$executeRawUnsafe('TRUNCATE "Category","Product","Attribute","Tag","User","Coupon","CustomerSegment" CASCADE');
  console.log('CATALOG+CUSTOMERS E2E OK');
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
