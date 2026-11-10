// Precio efectivo de un producto o variante en un momento dado. Funciones puras.
//
// price/compareAtPrice son el precio "de lista" cargado a mano (compareAtPrice = tachado). Si hay un precio
// promocional (promoPrice) y hoy cae dentro de su ventana de fechas, ese pasa a ser el precio de venta y el
// precio de lista se muestra tachado.

export type PricingInput = {
  price: number;
  compareAtPrice: number | null;
  promoPrice?: number | null;
  promoStartsAt?: Date | null;
  promoEndsAt?: Date | null;
};

export function isPromoActive(p: Pick<PricingInput, "price" | "promoPrice" | "promoStartsAt" | "promoEndsAt">, now = new Date()): boolean {
  if (p.promoPrice === null || p.promoPrice === undefined || p.promoPrice < 0 || p.promoPrice >= p.price) return false;
  if (p.promoStartsAt && p.promoStartsAt.getTime() > now.getTime()) return false;
  if (p.promoEndsAt && p.promoEndsAt.getTime() < now.getTime()) return false;
  return true;
}

export function effectivePricing(p: PricingInput, now = new Date()): { price: number; compareAtPrice: number | null; onPromo: boolean } {
  if (isPromoActive(p, now)) return { price: p.promoPrice!, compareAtPrice: p.price, onPromo: true };
  return { price: p.price, compareAtPrice: p.compareAtPrice, onPromo: false };
}
