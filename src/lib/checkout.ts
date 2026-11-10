import { prisma } from "@/lib/prisma";
import { effectivePricing } from "@/lib/pricing";
import { publishedNow } from "@/lib/catalogVisibility";
import { InvalidCheckoutError, normalizeCheckoutItems, type CheckoutItem } from "@/lib/checkoutItems";

// Never trust prices or names supplied by the browser: todo se re-lee de la
// base. Un producto variable exige una variante habilitada.
export async function getCheckoutItems(input: unknown): Promise<CheckoutItem[]> {
  const items = normalizeCheckoutItems(input);
  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, ...publishedNow() },
    include: {
      variants: {
        where: { enabled: true },
        include: { terms: { include: { term: true } } },
      },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const now = new Date();

  const measure = (v: { weight: number | null; width: number | null; height: number | null; length: number | null }, p: typeof v) => ({
    weight: v.weight ?? p.weight ?? null,
    width: v.width ?? p.width ?? null,
    height: v.height ?? p.height ?? null,
    length: v.length ?? p.length ?? null,
  });

  return items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new InvalidCheckoutError("Un producto del carrito ya no está disponible");

    if (product.type === "simple") {
      if (item.variantId) throw new InvalidCheckoutError("Un producto del carrito ya no está disponible");
      return { ...item, name: product.name, sku: product.sku, price: effectivePricing(product, now).price, ...measure(product, product) };
    }

    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant) throw new InvalidCheckoutError("Un producto del carrito ya no está disponible");
    const label = variant.terms.map((t) => t.term.name).join(" / ");
    return {
      ...item,
      name: label ? `${product.name} — ${label}` : product.name,
      sku: variant.sku ?? product.sku,
      price: effectivePricing({ ...variant, promoStartsAt: product.promoStartsAt, promoEndsAt: product.promoEndsAt }, now).price,
      ...measure(variant, product),
    };
  });
}
