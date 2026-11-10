import { resolveItemCategoryChains } from "@/lib/categories";

type Item = { productId: string; quantity: number; price: number };
type Config = { discountPct: number; categoryDiscounts: { categoryId: string; discountPct: number }[] };

// Calcula el descuento por medio de pago línea por línea: cada ítem usa la
// tasa de la excepción de categoría más específica que le aplique (su propia
// categoría primero, subiendo hacia la raíz), o el discountPct plano si
// ninguna excepción matchea. Si no hay excepciones cargadas para este medio
// de pago, evita consultar categorías y aplica el flujo de siempre.
export async function calculatePaymentMethodDiscount(items: Item[], config: Config): Promise<number> {
  if (config.categoryDiscounts.length === 0) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return subtotal * (config.discountPct / 100);
  }

  const chains = await resolveItemCategoryChains(items);
  const overrideByCategory = new Map(config.categoryDiscounts.map((o) => [o.categoryId, o.discountPct]));

  let totalDiscount = 0;
  for (const item of items) {
    const chain = chains.get(item.productId) ?? [];
    const matchedCategoryId = chain.find((categoryId) => overrideByCategory.has(categoryId));
    const pct = matchedCategoryId !== undefined ? overrideByCategory.get(matchedCategoryId)! : config.discountPct;
    totalDiscount += item.price * item.quantity * (pct / 100);
  }
  return totalDiscount;
}
