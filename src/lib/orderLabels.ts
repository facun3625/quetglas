import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// Labels puros (sin dependencias de servidor) para poder usarlos también en
// componentes cliente del panel.

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pago pendiente",
  confirmed: "Confirmado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-50 text-green-700",
  delivered: "bg-blue-50 text-blue-700",
  cancelled: "bg-red-50 text-red-700",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
  payway: "Tarjeta (Payway)",
  sin_pago: "Sin pago online",
};

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}
