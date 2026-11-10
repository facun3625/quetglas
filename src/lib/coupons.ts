import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { resolveItemCategoryChains } from "@/lib/categories";

type ValidateOpts = {
  subtotal: number;
  paymentMethod?: string;
  items: { productId: string; quantity: number }[];
  userId?: string;
  // Para los cupones de uso único por cliente (si no hay cuenta se identifica por email)
  customerEmail?: string;
};

type ValidateResult =
  | { ok: true; couponId: string; discountAmount: number; freeShipping: boolean }
  | { ok: false; error: string };

async function anyItemInCategory(items: { productId: string }[], categoryId: string): Promise<boolean> {
  const chains = await resolveItemCategoryChains(items);
  return [...chains.values()].some((chain) => chain.includes(categoryId));
}

// Valida un código de cupón contra el carrito/medio de pago actual. No
// registra el uso (eso pasa en /api/orders recién cuando el pedido se crea
// de verdad) — esto es lo que usa tanto el preview del checkout como la
// revalidación server-side final.
export async function validateCoupon(code: string, opts: ValidateOpts): Promise<ValidateResult> {
  const coupon = await prisma.coupon.findFirst({
    where: { code: { equals: code.trim(), mode: "insensitive" } },
  });

  if (!coupon || !coupon.enabled) {
    return { ok: false, error: "Cupón inválido" };
  }
  // Cupones generados por un canje de puntos quedan atados a ese usuario.
  if (coupon.userId && coupon.userId !== opts.userId) {
    return { ok: false, error: "Este cupón no te pertenece" };
  }
  if (coupon.startsAt && coupon.startsAt > new Date()) {
    return { ok: false, error: `Este cupón todavía no está vigente (empieza el ${coupon.startsAt.toLocaleDateString("es-AR")})` };
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    return { ok: false, error: "Este cupón venció" };
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: "Este cupón ya alcanzó el límite de usos" };
  }
  if (coupon.oneUsePerCustomer) {
    const keys = customerKeys(opts.userId, opts.customerEmail);
    if (keys.length === 0) return { ok: false, error: "Ingresá tu email para usar este cupón" };
    const used = await prisma.couponRedemption.findFirst({ where: { couponId: coupon.id, customerKey: { in: keys } }, select: { id: true } });
    if (used) return { ok: false, error: "Ya usaste este cupón" };
  }
  if (coupon.paymentMethod && coupon.paymentMethod !== opts.paymentMethod) {
    return { ok: false, error: "Este cupón no aplica con el medio de pago elegido" };
  }
  if (coupon.minPurchaseAmount && opts.subtotal < coupon.minPurchaseAmount) {
    return { ok: false, error: `Este cupón requiere una compra mínima de ${formatMoneyWith(coupon.minPurchaseAmount, (await getStoreSettingsRow()).currency)}` };
  }
  if (coupon.productId && !opts.items.some((i) => i.productId === coupon.productId)) {
    return { ok: false, error: "Este cupón no aplica a los productos del carrito" };
  }
  if (coupon.categoryId && !(await anyItemInCategory(opts.items, coupon.categoryId))) {
    return { ok: false, error: "Este cupón no aplica a los productos del carrito" };
  }

  // El cupón de envío gratis no descuenta productos: bonifica el envío
  if (coupon.discountType === "free_shipping") return { ok: true, couponId: coupon.id, discountAmount: 0, freeShipping: true };

  const discountAmount =
    coupon.discountType === "percentage"
      ? opts.subtotal * (coupon.discountValue / 100)
      : Math.min(coupon.discountValue, opts.subtotal);

  return { ok: true, couponId: coupon.id, discountAmount, freeShipping: false };
}

// Identificadores con los que se reconoce a un cliente: su cuenta y su email (así no se esquiva el
// "uso único" comprando una vez con cuenta y otra como invitado).
export function customerKeys(userId?: string | null, email?: string | null): string[] {
  const keys: string[] = [];
  if (userId) keys.push(userId);
  const e = email?.trim().toLowerCase();
  if (e) keys.push(e);
  return keys;
}

export async function registerCouponUse(couponId: string, who?: { userId?: string | null; email?: string | null; orderId?: string }) {
  const coupon = await prisma.coupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });

  // Uso único por cliente: se registra quién lo usó (con su cuenta y su email)
  if (coupon.oneUsePerCustomer && who) {
    const keys = customerKeys(who.userId, who.email);
    if (keys.length > 0) {
      await prisma.couponRedemption.createMany({
        data: keys.map((customerKey) => ({ couponId, customerKey, orderId: who.orderId ?? null })),
        skipDuplicates: true,
      });
    }
  }

  // Los cupones de canje de puntos (código "CANJE-...") son de un solo uso:
  // se autodesactivan apenas se usan una vez, en vez de depender de un
  // usageLimit que nunca se les carga.
  if (coupon.code.startsWith("CANJE-")) {
    await prisma.coupon.update({ where: { id: couponId }, data: { enabled: false } });
  }
}

// Si el pedido se cancela, el cupón de uso único queda libre para que el cliente lo vuelva a usar
export async function releaseCouponForOrder(db: Pick<typeof prisma, "couponRedemption" | "coupon">, orderId: string) {
  const redeemed = await db.couponRedemption.findMany({ where: { orderId }, select: { couponId: true } });
  if (redeemed.length === 0) return;
  await db.couponRedemption.deleteMany({ where: { orderId } });
  for (const couponId of new Set(redeemed.map((r) => r.couponId))) {
    await db.coupon.updateMany({ where: { id: couponId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
  }
}
