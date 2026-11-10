import { prisma } from "@/lib/prisma";
import { normalizeCheckoutItems } from "@/lib/checkoutItems";
import type { Prisma } from "@/generated/prisma/client";
import { releaseCouponForOrder } from "@/lib/coupons";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type StockLine = { productId: string; variantId: string | null; quantity: number; name: string };
export type StockShortage = { productId: string; variantId: string | null; name: string; available: number; requested: number };

// Se lanza cuando, al confirmar el pedido (ya con el candado tomado), no
// alcanza el stock para algún item.
export class InsufficientStockError extends Error {
  constructor(public shortages: StockShortage[]) {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
  }
}

// Stock = el campo `stock` de la base. Se descuenta al CREAR el pedido (dentro
// de la transacción, bajo lock) y se repone si se cancela o se elimina: así lo
// que ve el cliente ya es el disponible real, sin tabla de reservas aparte.
//
// Productos con manageStock = false no validan ni descuentan.

async function lockLines(tx: Tx, lines: { productId: string; variantId: string | null }[]) {
  // Locks en orden estable para no generar deadlocks entre dos pedidos que
  // comparten productos. Se sueltan solos al cerrar la transacción.
  const keys = [...new Set(lines.map((l) => l.variantId ?? l.productId))].sort();
  for (const key of keys) {
    // $executeRaw (no $queryRaw): pg_advisory_xact_lock devuelve "void" y el
    // driver adapter no puede deserializar esa columna en una consulta de filas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('order_stock'), hashtext(${key}))`;
  }
}

async function loadStock(tx: Tx, lines: { productId: string; variantId: string | null }[]) {
  const variantIds = lines.map((l) => l.variantId).filter((v): v is string => !!v);
  const productIds = lines.filter((l) => !l.variantId).map((l) => l.productId);
  const [variants, products] = await Promise.all([
    variantIds.length
      ? tx.variant.findMany({ where: { id: { in: variantIds } }, select: { id: true, stock: true, manageStock: true } })
      : [],
    productIds.length
      ? tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, stock: true, manageStock: true } })
      : [],
  ]);
  return {
    variants: new Map(variants.map((v) => [v.id, v])),
    products: new Map(products.map((p) => [p.id, p])),
  };
}

// Chequeo de stock informativo (previo a crear el pedido).
export async function checkStock(
  input: { productId: string; variantId: string | null; quantity: number }[],
  names: Map<string, string> = new Map()
): Promise<{ ok: boolean; shortages: StockShortage[] }> {
  const lines = normalizeCheckoutItems(input);
  const stock = await loadStock(prisma, lines);
  const shortages: StockShortage[] = [];
  for (const line of lines) {
    const row = line.variantId ? stock.variants.get(line.variantId) : stock.products.get(line.productId);
    const name = names.get(line.variantId ?? line.productId) ?? "Producto";
    if (!row) {
      shortages.push({ ...line, name: "Producto no encontrado", available: 0, requested: line.quantity });
    } else if (row.manageStock && row.stock < line.quantity) {
      shortages.push({ ...line, name, available: Math.max(0, row.stock), requested: line.quantity });
    }
  }
  return { ok: shortages.length === 0, shortages };
}

async function applyStockDelta(tx: Tx, line: { productId: string; variantId: string | null; quantity: number }, sign: 1 | -1) {
  const data = { stock: { increment: sign * line.quantity } };
  if (line.variantId) {
    await tx.variant.updateMany({ where: { id: line.variantId, manageStock: true }, data });
  } else {
    await tx.product.updateMany({ where: { id: line.productId, manageStock: true }, data });
  }
}

// Crea el pedido bajo un lock por producto/variante: valida el stock, lo
// descuenta y ejecuta `build` en la MISMA transacción. Dos checkouts
// simultáneos de la última unidad no pasan los dos. `build` debe crear el
// pedido con `stockDeductedAt: new Date()` (ver STOCK_DEDUCTED).
export async function createOrderWithStockGuard<T>(
  items: StockLine[],
  build: (tx: Tx) => Promise<T>
): Promise<T> {
  const names = new Map(items.map((i) => [i.variantId ?? i.productId, i.name]));
  const lines = normalizeCheckoutItems(items);

  return prisma.$transaction(async (tx) => {
    await lockLines(tx, lines);
    const stock = await loadStock(tx, lines);

    const shortages: StockShortage[] = [];
    for (const line of lines) {
      const row = line.variantId ? stock.variants.get(line.variantId) : stock.products.get(line.productId);
      const name = names.get(line.variantId ?? line.productId) ?? "Producto";
      if (!row) {
        shortages.push({ ...line, name, available: 0, requested: line.quantity });
      } else if (row.manageStock && row.stock < line.quantity) {
        shortages.push({ ...line, name, available: Math.max(0, row.stock), requested: line.quantity });
      }
    }
    if (shortages.length > 0) throw new InsufficientStockError(shortages);

    for (const line of lines) await applyStockDelta(tx, line, -1);
    return build(tx);
  });
}

export const STOCK_DEDUCTED = () => ({ stockDeductedAt: new Date() });

// Repone el stock de un pedido y marca que ya no está descontado. Idempotente:
// si el pedido nunca descontó (o ya se repuso) no hace nada.
export async function restoreStockForOrder(tx: Tx, orderId: string): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { stockDeductedAt: true, items: { select: { productId: true, variantId: true, quantity: true } } },
  });
  if (!order?.stockDeductedAt) return false;
  // Marca primero con una condición para que dos cancelaciones simultáneas no repongan dos veces.
  const { count } = await tx.order.updateMany({
    where: { id: orderId, stockDeductedAt: { not: null } },
    data: { stockDeductedAt: null },
  });
  if (count === 0) return false;
  for (const item of order.items) {
    if (!item.productId) continue; // el producto se borró: no hay nada que reponer
    await applyStockDelta(tx, { productId: item.productId, variantId: item.variantId, quantity: item.quantity }, 1);
  }
  // El pedido deja de contar: el cupón de uso único vuelve a estar disponible para ese cliente
  await releaseCouponForOrder(tx, orderId);
  return true;
}

// Vuelve a descontar el stock de un pedido que se reabre tras haber sido
// cancelado. Falla (InsufficientStockError) si ya no alcanza.
export async function deductStockForOrder(tx: Tx, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { stockDeductedAt: true, items: { select: { productId: true, variantId: true, quantity: true, name: true } } },
  });
  if (!order || order.stockDeductedAt) return;
  const lines = order.items.filter((i) => i.productId) as { productId: string; variantId: string | null; quantity: number; name: string }[];
  await lockLines(tx, lines);
  const stock = await loadStock(tx, lines);
  const shortages: StockShortage[] = [];
  for (const line of lines) {
    const row = line.variantId ? stock.variants.get(line.variantId) : stock.products.get(line.productId);
    if (row?.manageStock && row.stock < line.quantity) {
      shortages.push({ ...line, available: Math.max(0, row.stock), requested: line.quantity });
    }
  }
  if (shortages.length > 0) throw new InsufficientStockError(shortages);
  for (const line of lines) await applyStockDelta(tx, line, -1);
  await tx.order.update({ where: { id: orderId }, data: { stockDeductedAt: new Date() } });
}

// Cancela el pedido y repone su stock en una sola transacción. `data`
// permite sumar campos (ej. el id del pago reembolsado).
export async function cancelOrder(orderId: string, data: Prisma.OrderUpdateInput = {}) {
  return prisma.$transaction(async (tx) => {
    await restoreStockForOrder(tx, orderId);
    return tx.order.update({ where: { id: orderId }, data: { ...data, status: "cancelled" } });
  });
}

// Guarda el teléfono en el usuario logueado la primera vez que lo tipea en
// un checkout — así queda disponible para contactarlo por WhatsApp desde
// carritos abandonados aunque ESE carrito puntual no haya cargado teléfono.
// Se llama dentro de la misma transacción que crea el pedido.
export async function saveUserPhone(tx: Tx, userId: string | undefined, phone: string | undefined): Promise<void> {
  if (!userId || !phone) return;
  await tx.user.update({ where: { id: userId }, data: { phone } });
}
