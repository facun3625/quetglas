// Runtime validation shared by every checkout and stock guard.
export class InvalidCheckoutError extends Error {}

// variantId es null para productos simples.
export type CheckoutQuantity = { productId: string; variantId: string | null; quantity: number };
export type CheckoutItem = CheckoutQuantity & {
  name: string;
  sku: string | null;
  price: number;
  // Medidas para cotizar el envío (kg y cm). La variante pisa a las del producto; null = usar los valores por defecto de la tienda
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
};

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function normalizeCheckoutItems(input: unknown): CheckoutQuantity[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 500) {
    throw new InvalidCheckoutError("El carrito es inválido o está vacío");
  }
  const quantities = new Map<string, CheckoutQuantity>();
  for (const item of input) {
    const variantId = item?.variantId ?? null;
    if (
      !item ||
      typeof item.productId !== "string" ||
      !ID_PATTERN.test(item.productId) ||
      (variantId !== null && (typeof variantId !== "string" || !ID_PATTERN.test(variantId))) ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 2147483647
    ) {
      throw new InvalidCheckoutError("Los productos y cantidades son inválidos");
    }
    const key = `${item.productId}:${variantId ?? ""}`;
    const quantity = (quantities.get(key)?.quantity ?? 0) + item.quantity;
    if (quantity > 2147483647) throw new InvalidCheckoutError("Cantidad inválida");
    quantities.set(key, { productId: item.productId, variantId, quantity });
  }
  return Array.from(quantities.values());
}
