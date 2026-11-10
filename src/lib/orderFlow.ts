import { prisma } from "@/lib/prisma";
import { registerCouponUse } from "@/lib/coupons";
import { notifyNewOrder } from "@/lib/telegram";
import { sendOrderConfirmation } from "@/lib/orderEmails";
import { sendOrderToStore } from "@/lib/orderStoreEmail";

type Db = Pick<typeof prisma, "orderEvent">;

// Historial del pedido (estados, pagos, conciliaciones, notas y avisos).
export async function addOrderEvent(
  orderId: string,
  type: "status" | "payment" | "note" | "email" | "system",
  message: string,
  actor: string | null = null,
  db: Db = prisma
) {
  try {
    await db.orderEvent.create({ data: { orderId, type, message: message.slice(0, 1000), actor } });
  } catch (err) {
    // El historial nunca debe frenar una venta
    console.error("addOrderEvent failed", orderId, err);
  }
}

// Efectos de "pedido nuevo válido": suma el uso del cupón y manda los avisos (mail al
// cliente + Telegram). Idempotente: se reclama con noticesSentAt, así un pago incierto que
// se resuelve después por webhook dispara los avisos una sola vez.
export async function finalizeOrder(orderId: string): Promise<boolean> {
  const claim = await prisma.order.updateMany({ where: { id: orderId, noticesSentAt: null }, data: { noticesSentAt: new Date() } });
  if (claim.count === 0) return false;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingMethod: { select: { name: true, requiresAddress: true } } },
  });
  if (!order) return false;

  if (order.couponId) {
    try {
      await registerCouponUse(order.couponId, { userId: order.userId, email: order.customerEmail, orderId: order.id });
    } catch (err) {
      console.error("Could not register coupon for order", order.id, order.couponId, err);
    }
  }

  const items = order.items.map((i) => ({ name: i.name, quantity: i.quantity }));
  // El descuento por medio de pago no se guarda aparte: se deduce de los totales del pedido.
  const methodDiscount = Math.max(0, order.subtotal - order.couponDiscount - order.zipDiscount + order.shippingCost - order.total);
  void notifyNewOrder({
    orderId: order.id,
    orderNumber: order.number,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    paymentMethod: order.paymentMethod,
    total: order.total,
    items,
    shippingName: order.shippingName ?? order.shippingMethod?.name ?? null,
    shippingAddress: order.shippingAddress,
  }).catch((err) => console.error("Order notification failed", order.id, err));

  void sendOrderConfirmation({
    orderId: order.id,
    orderNumber: order.number,
    to: order.customerEmail,
    customerName: order.customerName,
    items,
    subtotal: order.subtotal,
    discountTotal: order.couponDiscount + order.zipDiscount + methodDiscount,
    shippingName: order.shippingName ?? order.shippingMethod?.name ?? "",
    shippingCost: order.shippingCost,
    total: order.total,
    paymentMethod: order.paymentMethod,
    shippingAddress: order.shippingAddress,
    userId: order.userId ?? undefined,
  }).catch((err) => console.error("Order confirmation failed", order.id, err));
  if (order.paymentMethod === "sin_pago") {
    void sendOrderToStore(order.id).catch((err) => console.error("sendOrderToStore failed", order.id, err));
  }
  return true;
}
