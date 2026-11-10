import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { buildSalesWhere } from "@/lib/sales";
import { formatOrderNumber } from "@/lib/orderNumber";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/orderLabels";
import { toCsv } from "@/lib/csv";
import { dayToInstant } from "@/lib/storeTime";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];
const PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];
const MAX_ROWS = 20000;

// Exporta a planilla (CSV) los pedidos con los mismos filtros que la pantalla de Ventas.
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const payment = sp.get("payment") as PaymentMethod | null;
  const status = sp.get("status") as OrderStatus | null;

  const orders = await prisma.order.findMany({
    where: buildSalesWhere({
      q: sp.get("q")?.trim() || undefined,
      paymentMethod: payment && PAYMENTS.includes(payment) ? payment : undefined,
      status: status && STATUSES.includes(status) ? status : undefined,
      productId: sp.get("productId") || undefined,
      from: dayToInstant(sp.get("from")),
      to: dayToInstant(sp.get("to"), true),
    }),
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: { items: true, shippingMethod: { select: { name: true } }, coupon: { select: { code: true } } },
  });

  const rows: (string | number | null)[][] = [
    ["numero", "fecha", "cliente", "email", "telefono", "estado", "medio_de_pago", "envio", "direccion", "subtotal", "descuento_cupon", "cupon", "costo_envio", "total", "moneda", "productos"],
  ];
  for (const o of orders) {
    rows.push([
      formatOrderNumber(o.number),
      o.createdAt.toISOString().slice(0, 19).replace("T", " "),
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      orderStatusLabel(o.status),
      paymentMethodLabel(o.paymentMethod),
      o.shippingName ?? o.shippingMethod?.name ?? "",
      o.shippingAddress,
      o.subtotal,
      o.couponDiscount,
      o.zipDiscount,
      o.coupon?.code ?? "",
      o.shippingCost,
      o.total,
      o.currency,
      o.items.map((i) => `${i.quantity}x ${i.name}${i.sku ? ` (${i.sku})` : ""}`).join(" | "),
    ]);
  }
  return new Response("﻿" + toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pedidos.csv"' },
  });
}
