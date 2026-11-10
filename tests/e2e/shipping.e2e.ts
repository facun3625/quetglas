import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import * as actions from '@/app/admin/(dashboard)/productos/actions';
import * as ship from '@/app/admin/(dashboard)/envios/actions';
import { getCheckoutItems } from '@/lib/checkout';
import { priceOrder } from '@/lib/orderPricing';
import { getShippingOptions, loadShippingConfig } from '@/lib/shippingFlow';
import { createCoupon } from '@/app/admin/(dashboard)/cupones/actions';
import { registerOcaShipment } from '@/app/admin/(dashboard)/ventas/actions';

const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = {
  name: 'Mesa', slug: '', sku: 'MESA', type: 'simple' as const, status: 'published' as const, shortDescription: '', description: '', videoUrl: '',
  price: 10000, compareAtPrice: null, stock: 10, manageStock: true, weight: 12, width: 80, height: 75, length: 120, featured: false,
  costPrice: null, publishAt: '', unpublishAt: '', promoPrice: null, promoStartsAt: '', promoEndsAt: '', tags: [] as string[], relatedIds: [] as string[],
  seoTitle: '', seoDescription: '', categoryIds: [] as string[], images: [{ url: 'https://x.test/a.webp', thumbUrl: null, alt: '' }], attributeIds: [], variants: [],
};
const ADDR = { street: 'Mitre', number: '100', apartment: '', city: 'Rosario', province: 'Santa Fe', zipCode: '2000' };

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Product","Coupon","ShippingMethod","PaymentMethodConfig","ZipCodeRestriction","ZipCodeDiscount","Order" CASCADE');
  await prisma.storeSettings.deleteMany();

  const p = await actions.saveProduct(base);
  assert.equal(p.ok, true, JSON.stringify(p));
  const pid = (p as { id: string }).id;
  const config = await prisma.paymentMethodConfig.create({ data: { method: 'transferencia', enabled: true, discountPct: 0 }, include: { categoryDiscounts: true } });
  const items = await getCheckoutItems([{ productId: pid, variantId: null, quantity: 2 }]);
  assert.deepEqual([items[0].weight, items[0].width, items[0].height, items[0].length], [12, 80, 75, 120], 'medidas del producto en el checkout');

  const price = (shipping: unknown, couponCode?: string) => priceOrder({ items, config, paymentMethod: 'transferencia', shipping, couponCode, customerEmail: 'a@example.com' });

  // por defecto: "a acordar" encendido, OCA apagado
  let r = await price({ code: 'acordar', address: ADDR });
  assert.equal(r.ok, true); if (r.ok) { assert.equal(r.total, 20000); assert.equal(r.shippingFields.shippingCode, 'acordar'); assert.equal(r.shippingFields.shippingMethodId, null); }
  assert.equal((await price({ code: 'oca_domicilio', address: ADDR })).ok, false, 'OCA apagado no se puede forzar');
  assert.equal((await price({ code: 'acordar' })).ok, false, 'falta la dirección');

  // interruptor de "a acordar"
  await ship.saveShippingGeneral(form({ zipRestrictionsEnabled: 'on', zipDiscountsEnabled: 'on', shippingDefaultWeightKg: '1', shippingDefaultDimCm: '20' }));
  assert.equal((await price({ code: 'acordar', address: ADDR })).ok, false, 'acordar apagado');

  // restricciones por CP
  await ship.createZipRestriction(form({ zipCodes: '9400, 9410', type: 'block_shipping', message: 'Solo cadete' }));
  await ship.createZipRestriction(form({ zipCodes: '1000', type: 'block_sale', message: 'No vendemos acá', address: 'Local 1', phone: '123' }));
  const sale = await price({ code: 'acordar', address: { ...ADDR, zipCode: '1000' } });
  assert.equal(sale.ok, false); if (!sale.ok) assert.equal(sale.error, 'No vendemos acá');
  const opts = await getShippingOptions({ zipCode: '1000', items, subtotal: 20000, paymentMethodConfigId: config.id });
  assert.equal(opts.restriction?.type, 'block_sale'); assert.equal(opts.options.length, 0);
  const opts2 = await getShippingOptions({ zipCode: '9400', items, subtotal: 20000 });
  assert.equal(opts2.options.some((o) => o.code === 'acordar' || o.code.startsWith('oca')), false, 'zona sin correo: sin OCA ni acordar');

  // descuento por CP + cupón (se suman) y envío gratis por umbral
  await ship.createZipDiscount(form({ zipCodes: '2000', discountType: 'percentage', discountValue: '10', label: 'Rosario' }));
  await ship.saveShippingGeneral(form({ acordarEnabled: 'on', zipRestrictionsEnabled: 'on', zipDiscountsEnabled: 'on', freeShippingEnabled: 'on', freeShippingThreshold: '15000', shippingDefaultWeightKg: '1', shippingDefaultDimCm: '20' }));
  await createCoupon(form({ code: 'MENOS1000', enabled: 'on', discountType: 'fixed', discountValue: '1000' }));
  r = await price({ code: 'acordar', address: ADDR }, 'MENOS1000');
  assert.equal(r.ok && r.zipDiscount, 2000);
  assert.equal(r.ok && r.total, 20000 - 1000 - 2000);
  assert.equal(r.ok && r.shippingFields.shippingAddress?.includes('CP 2000'), true);
  const o = await getShippingOptions({ zipCode: '2000', items, subtotal: 20000 });
  assert.equal(o.zipDiscount?.amount, 2000); assert.equal(o.freeShipping.active, true);

  // cupón de envío gratis (sin valor) y sin umbral
  await ship.saveShippingGeneral(form({ acordarEnabled: 'on', zipRestrictionsEnabled: 'on', zipDiscountsEnabled: 'on', shippingDefaultWeightKg: '1', shippingDefaultDimCm: '20' }));
  await createCoupon(form({ code: 'ENVIOGRATIS', enabled: 'on', discountType: 'free_shipping' }));
  const fc = await prisma.coupon.findFirstOrThrow({ where: { code: 'ENVIOGRATIS' } });
  assert.equal(fc.discountType, 'free_shipping');
  await createCoupon(form({ code: 'CERO', enabled: 'on', discountType: 'percentage', discountValue: '0' }));
  assert.equal(await prisma.coupon.count({ where: { code: 'CERO' } }), 0, 'cupón común sin valor no se crea');
  const f = await price({ code: 'acordar', address: ADDR }, 'ENVIOGRATIS');
  assert.equal(f.ok, true);
  const fo = await getShippingOptions({ zipCode: '9400', items, subtotal: 20000, couponFreeShipping: true });
  assert.equal(fo.freeShipping.active, true);

  // OCA: configuración guardada con la contraseña oculta
  await ship.saveOcaSettings(form({ ocaEnabled: 'on', ocaCuit: '30-12345678-9', ocaOperativa: '111', ocaOriginZipCode: '3000', ocaUser: 'u@x.com', ocaPassword: 'secreto', ocaNroCliente: '1', ocaBranchDiscountPct: '30' }));
  await ship.saveOcaSettings(form({ ocaEnabled: 'on', ocaCuit: '30-12345678-9', ocaOperativa: '111', ocaOriginZipCode: '3000', ocaUser: 'u@x.com', ocaPassword: '', ocaNroCliente: '1' }));
  const cfg = await loadShippingConfig();
  assert.equal(cfg.oca.password, 'secreto', 'contraseña en blanco no la borra');
  assert.equal(cfg.ocaEnabled, true);
  assert.equal((await price({ code: 'oca_domicilio', address: { ...ADDR, zipCode: '9400' } })).ok, false, 'OCA no cotiza en zona sin correo');
  assert.equal((await price({ code: 'oca_domicilio', address: { ...ADDR, zipCode: 'ABC' } })).ok, false);

  // pedido real con envío a acordar: se guardan snapshot de medidas y se rechaza registrar en OCA
  const order = await prisma.order.create({
    data: { customerName: 'Ana Pérez', customerEmail: 'a@example.com', customerPhone: '3425550000', subtotal: 20000, total: 20000, paymentMethod: 'transferencia', shippingCode: 'acordar', shippingName: 'Envío a acordar', shippingCost: 0, currency: 'ARS',
      items: { create: [{ productId: pid, name: 'Mesa', price: 10000, quantity: 2, weight: 12, width: 80, height: 75, length: 120 }] } },
  });
  const reg = await registerOcaShipment(order.id);
  assert.equal(reg.ok, false); assert.match(reg.message, /no tiene un envío de OCA/);
  const oca = await prisma.order.create({
    data: { customerName: 'Ana Pérez', customerEmail: 'a@example.com', subtotal: 1, total: 1, paymentMethod: 'transferencia', shippingCode: 'oca_domicilio', shippingCost: 0, currency: 'ARS' },
  });
  assert.equal((await registerOcaShipment(oca.id)).ok, false, 'sin dirección no registra');

  // direcciones guardadas: borrado de usuario las elimina (cascade)
  const user = await prisma.user.create({ data: { email: 'u@example.com', name: 'U' } });
  await prisma.address.create({ data: { userId: user.id, ...ADDR, apartment: null } });
  await prisma.user.delete({ where: { id: user.id } });
  assert.equal(await prisma.address.count(), 0);

  console.log('shipping e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
