import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { parseOrderNumber } from "@/lib/orderNumber";
import { getStoreSettingsRow } from "@/lib/settings";
import { shipmentPackage } from "@/lib/oca/package";

// Re-exportados desde el módulo puro para no romper imports existentes.
export { orderStatusLabel, paymentMethodLabel } from "@/lib/orderLabels";

export type SalesFilterOpts = {
  q?: string;
  paymentMethod?: PaymentMethod;
  status?: OrderStatus;
  productId?: string;
  from?: Date;
  to?: Date;
};

// Mismo criterio de filtros para la lista de ventas y para la exportación a planilla
export function buildSalesWhere(opts: Pick<SalesFilterOpts, "q" | "paymentMethod" | "status" | "productId" | "from" | "to">): Prisma.OrderWhereInput {
  return {
    ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.productId ? { items: { some: { productId: opts.productId } } } : {}),
    ...(opts.from || opts.to
      ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {}),
    ...(opts.q
      ? {
          OR: [
            ...(parseOrderNumber(opts.q) !== null ? [{ number: parseOrderNumber(opts.q)! }] : []),
            { customerName: { contains: opts.q, mode: "insensitive" } },
            { customerEmail: { contains: opts.q, mode: "insensitive" } },
            { customerPhone: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function getSalesPage(opts: SalesFilterOpts & { limit: number; offset: number }) {
  const where = buildSalesWhere(opts);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
      select: {
        id: true,
        number: true,
        userId: true,
        mercadopagoPaymentId: true,
        events: { orderBy: { createdAt: "desc" as const }, take: 100, select: { id: true, type: true, message: true, actor: true, createdAt: true } },
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        subtotal: true,
        total: true,
        status: true,
        paymentMethod: true,
        transferProofUrl: true,
        shippingCost: true,
        shippingAddress: true,
        couponDiscount: true,
        zipDiscount: true,
        createdAt: true,
        adminSeenAt: true,
        shippingMethod: { select: { name: true } },
        shippingCode: true,
        shippingName: true,
        shippingData: true,
        contactFirstName: true,
        contactLastName: true,
        trackingNumber: true,
        ocaRegisteredAt: true,
        items: { select: { id: true, name: true, price: true, quantity: true, weight: true, width: true, height: true, length: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  // Lo que se le va a pedir a OCA por cada pedido con OCA (el panel lo muestra antes de registrar el envío)
  const { shippingDefaultWeightKg, shippingDefaultDimCm } = await getStoreSettingsRow();
  const defaults = { weightKg: shippingDefaultWeightKg, dimCm: shippingDefaultDimCm };
  const withPreview = orders.map((o) => ({
    ...o,
    ocaPreview: o.shippingCode?.startsWith("oca_") ? shipmentPackage(o.items, defaults) : null,
  }));

  return { orders: withPreview, total };
}

export type SalesOrder = Awaited<ReturnType<typeof getSalesPage>>["orders"][number];
