import { prisma } from "@/lib/prisma";
import { effectivePricing } from "@/lib/pricing";
import type { CartItem } from "@/lib/cart";

type SavedLine = { productId?: string; variantId?: string | null; quantity?: number };

// Reconstruye un carrito abandonado con datos de hoy (precio, stock, foto), no con
// los que quedaron guardados: así el link de recuperación funciona aunque haya
// cambiado un precio, y nunca ofrece algo sin stock o despublicado.
export async function recoverCartItems(cartId: string): Promise<CartItem[]> {
  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId }, select: { items: true } });
  const lines = (Array.isArray(cart?.items) ? cart.items : []) as SavedLine[];
  const ids = [...new Set(lines.map((l) => l.productId).filter((x): x is string => typeof x === "string"))];
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: "published" },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      categories: { take: 1, select: { categoryId: true } },
      variants: {
        where: { enabled: true },
        include: { image: { select: { url: true } }, terms: { include: { term: { select: { name: true } } } } },
      },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const out: CartItem[] = [];
  for (const line of lines) {
    const product = line.productId ? byId.get(line.productId) : undefined;
    const wanted = Math.max(1, Math.floor(Number(line.quantity) || 1));
    if (!product) continue;
    const window = { promoStartsAt: product.promoStartsAt, promoEndsAt: product.promoEndsAt };

    if (line.variantId) {
      const v = product.variants.find((x) => x.id === line.variantId);
      if (!v) continue;
      const stock = v.manageStock ? v.stock : 9999;
      if (stock <= 0) continue;
      out.push({
        productId: product.id,
        variantId: v.id,
        name: product.name,
        variantLabel: v.terms.map((t) => t.term.name).join(" / ") || undefined,
        price: effectivePricing({ price: v.price, compareAtPrice: v.compareAtPrice, promoPrice: v.promoPrice, ...window }).price,
        image: v.image?.url ?? product.images[0]?.url ?? null,
        quantity: Math.min(wanted, stock),
        maxStock: stock,
        categoryId: product.categories[0]?.categoryId,
      });
    } else {
      if (product.variants.length > 0) continue; // un variable sin variante elegida no se puede reconstruir
      const stock = product.manageStock ? product.stock : 9999;
      if (stock <= 0) continue;
      out.push({
        productId: product.id,
        variantId: null,
        name: product.name,
        price: effectivePricing({ price: product.price, compareAtPrice: product.compareAtPrice, promoPrice: product.promoPrice, ...window }).price,
        image: product.images[0]?.url ?? null,
        quantity: Math.min(wanted, stock),
        maxStock: stock,
        categoryId: product.categories[0]?.categoryId,
      });
    }
  }
  return out;
}
