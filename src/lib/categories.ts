import { prisma } from "@/lib/prisma";
import type { CategoryItem } from "@/types/catalog";

// Funciones puras que solo filtran un array ya obtenido viven en
// lib/categoryHelpers.ts — ese es el único archivo del que puede importar un
// client component (este importa Prisma).
export async function getAllCategories(): Promise<CategoryItem[]> {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true, parentId: true, imageUrl: true, comingSoonMessage: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

// Para cada producto, sus categorías propias seguidas de todas sus categorías
// ancestro hasta la raíz (de más específica a más general). Usado por el
// alcance por categoría de los cupones (lib/coupons.ts) y por las excepciones
// de descuento por categoría de un medio de pago (lib/paymentMethodDiscount.ts).
export async function resolveItemCategoryChains(
  items: { productId: string }[]
): Promise<Map<string, string[]>> {
  const ids = [...new Set(items.map((i) => i.productId))];
  const [links, categories] = await Promise.all([
    prisma.productCategory.findMany({ where: { productId: { in: ids } }, select: { productId: true, categoryId: true } }),
    getAllCategories(),
  ]);
  const byId = new Map(categories.map((c) => [c.id, c]));

  function chainFrom(startId: string): string[] {
    const chain: string[] = [];
    let current = byId.get(startId);
    while (current && !chain.includes(current.id)) {
      chain.push(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return chain;
  }

  const result = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const link of links) {
    const merged = new Set([...(result.get(link.productId) ?? []), ...chainFrom(link.categoryId)]);
    result.set(link.productId, [...merged]);
  }
  return result;
}
