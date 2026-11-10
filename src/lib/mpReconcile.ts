import { prisma } from "@/lib/prisma";
import {
  getMercadoPagoPayment,
  refundMercadoPagoPayment,
  searchMercadoPagoPayments,
  type MercadoPagoPayment,
} from "@/lib/mercadopago";
import { addOrderEvent, finalizeOrder } from "@/lib/orderFlow";
import { cancelOrder, deductStockForOrder, InsufficientStockError } from "@/lib/stock";

// Conciliación entre lo que informa Mercado Pago y lo que registra la tienda. Se dispara por
// webhook (notificación de MP) o a mano desde el panel. Es idempotente: se puede aplicar el
// mismo pago muchas veces y el resultado es el mismo.

export type ReconcileDeps = {
  accessToken: string;
  refund?: (paymentId: number) => Promise<{ ok: boolean; error?: string }>;
};

export type ReconcileResult =
  | { action: "ignored"; reason: string }
  | { action: "confirmed" | "cancelled" | "refunded_duplicate" | "reopened" | "pending" | "review" | "noop"; orderId: string };

const ACTOR = "Mercado Pago";
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.01;

// Evita llenar el historial con el mismo mensaje en cada reintento del webhook
async function eventOnce(orderId: string, message: string) {
  const exists = await prisma.orderEvent.findFirst({ where: { orderId, type: "payment", message }, select: { id: true } });
  if (!exists) await addOrderEvent(orderId, "payment", message, ACTOR);
}

export async function applyMercadoPagoPayment(payment: MercadoPagoPayment, deps: ReconcileDeps): Promise<ReconcileResult> {
  const orderId = payment.external_reference;
  if (!orderId) return { action: "ignored", reason: "El pago no tiene referencia externa" };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.paymentMethod !== "mercadopago") return { action: "ignored", reason: "El pago no corresponde a un pedido de la tienda" };

  const refund = deps.refund ?? ((id: number) => refundMercadoPagoPayment({ accessToken: deps.accessToken, paymentId: id }));
  const label = `Mercado Pago #${payment.id}`;

  switch (payment.status) {
    case "approved": {
      // Defensa: un pago aprobado por otro monto no confirma el pedido
      if (payment.transaction_amount !== undefined && !sameAmount(payment.transaction_amount, order.total)) {
        await eventOnce(orderId, `${label} aprobado por un monto distinto ($${payment.transaction_amount} vs. $${order.total}). Revisar a mano.`);
        return { action: "review", orderId };
      }
      // Pago duplicado: ya hay otro pago cobrado para este pedido -> se devuelve el extra
      if (order.mercadopagoPaymentId && order.mercadopagoPaymentId !== payment.id && (order.status === "confirmed" || order.status === "delivered")) {
        const result = await refund(payment.id);
        await eventOnce(orderId, result.ok ? `${label} era un cobro duplicado: se devolvió automáticamente.` : `${label} es un cobro duplicado y NO se pudo devolver (${result.error}). Devolverlo desde Mercado Pago.`);
        return { action: result.ok ? "refunded_duplicate" : "review", orderId };
      }
      if (order.status === "confirmed" || order.status === "delivered") {
        if (order.mercadopagoPaymentId === payment.id) return { action: "noop", orderId };
        // Confirmado por otra vía (a mano): se vincula el pago
        await prisma.order.update({ where: { id: orderId }, data: { mercadopagoPaymentId: payment.id } });
        await eventOnce(orderId, `${label} aprobado (pedido ya confirmado).`);
        return { action: "noop", orderId };
      }
      if (order.status === "cancelled") {
        // Se canceló (rechazo previo, timeout...) pero el pago finalmente se aprobó: se reabre si hay stock
        try {
          await prisma.$transaction(async (tx) => {
            await deductStockForOrder(tx, orderId);
            await tx.order.update({ where: { id: orderId }, data: { status: "confirmed", mercadopagoPaymentId: payment.id } });
          });
        } catch (err) {
          if (!(err instanceof InsufficientStockError)) throw err;
          const result = await refund(payment.id);
          await eventOnce(orderId, `${label} se aprobó cuando el pedido ya estaba cancelado y no hay stock: ${result.ok ? "se devolvió el cobro." : "NO se pudo devolver, hacerlo desde Mercado Pago."}`);
          return { action: result.ok ? "refunded_duplicate" : "review", orderId };
        }
        await eventOnce(orderId, `${label} aprobado: el pedido estaba cancelado y se reabrió.`);
        await finalizeOrder(orderId);
        return { action: "reopened", orderId };
      }
      // pending -> confirmed (condicional: dos webhooks simultáneos no lo confirman dos veces)
      const confirmed = await prisma.order.updateMany({ where: { id: orderId, status: "pending" }, data: { status: "confirmed", mercadopagoPaymentId: payment.id } });
      if (confirmed.count === 0) return { action: "noop", orderId };
      await eventOnce(orderId, `${label} aprobado: pedido confirmado.`);
      await finalizeOrder(orderId);
      return { action: "confirmed", orderId };
    }

    case "rejected":
    case "cancelled": {
      if (order.status !== "pending") return { action: "noop", orderId };
      await cancelOrder(orderId);
      await eventOnce(orderId, `${label} ${payment.status === "rejected" ? "rechazado" : "cancelado"}: pedido cancelado y stock repuesto.`);
      return { action: "cancelled", orderId };
    }

    case "refunded":
    case "charged_back": {
      const text = payment.status === "refunded" ? "devuelto" : "contracargo";
      if (order.status === "pending" || order.status === "confirmed") {
        await cancelOrder(orderId);
        await eventOnce(orderId, `${label} ${text}: pedido cancelado y stock repuesto.`);
        return { action: "cancelled", orderId };
      }
      await eventOnce(orderId, `${label} ${text} (el pedido ya figura ${order.status}). Revisar a mano.`);
      return { action: "review", orderId };
    }

    default: {
      // pending | in_process | authorized: el pedido sigue pendiente hasta que se resuelva
      await eventOnce(orderId, `${label} en proceso (${payment.status}${payment.status_detail ? `: ${payment.status_detail}` : ""}).`);
      return { action: "pending", orderId };
    }
  }
}

// A partir del id que informa la notificación
export async function reconcilePaymentById(paymentId: string, accessToken: string): Promise<ReconcileResult> {
  const payment = await getMercadoPagoPayment(accessToken, paymentId);
  return applyMercadoPagoPayment(payment, { accessToken });
}

// A mano desde el panel: busca los pagos del pedido en Mercado Pago y los aplica (los aprobados primero)
export async function reconcileOrder(orderId: string, accessToken: string): Promise<{ results: ReconcileResult[]; found: number }> {
  const payments = await searchMercadoPagoPayments(accessToken, orderId);
  payments.sort((a, b) => Number(b.status === "approved") - Number(a.status === "approved"));
  const results: ReconcileResult[] = [];
  for (const payment of payments) results.push(await applyMercadoPagoPayment(payment, { accessToken }));
  if (payments.length === 0) await eventOnce(orderId, "Conciliación manual: Mercado Pago no tiene pagos para este pedido.");
  return { results, found: payments.length };
}
