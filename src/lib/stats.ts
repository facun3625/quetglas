import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";

// "Vendido/facturado" = pedidos con el pago confirmado o ya entregados. Los
// pending (sin confirmar) y cancelled no cuentan como ingreso.
const PAID: OrderStatus[] = ["confirmed", "delivered"];

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type Granularity = "day" | "month";

export type SalesStats = {
  revenue: number;
  paidOrders: number;
  avgTicket: number;
  units: number;
  customers: number;
  discounts: number;
  shipping: number;
  revenueDelta: number | null; // % vs período anterior de igual duración
  pendingOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  byStatus: { status: OrderStatus; count: number }[];
  byPayment: { method: PaymentMethod; count: number; revenue: number }[];
  byShipping: { name: string; count: number; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  series: { label: string; revenue: number; orders: number }[];
};

function bucketKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return g === "month" ? `${y}-${m}` : `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildSeries(
  start: Date,
  end: Date,
  g: Granularity,
  map: Map<string, { revenue: number; orders: number }>
): SalesStats["series"] {
  const out: SalesStats["series"] = [];
  const cur =
    g === "month"
      ? new Date(start.getFullYear(), start.getMonth(), 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last =
    g === "month"
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : new Date(end.getFullYear(), end.getMonth(), end.getDate());

  // Tope de barras por si el rango es enorme (protege el render).
  let guard = 0;
  while (cur <= last && guard++ < 400) {
    const v = map.get(bucketKey(cur, g));
    const label = g === "month" ? MONTH_LABELS[cur.getMonth()] : `${cur.getDate()}/${cur.getMonth() + 1}`;
    out.push({ label, revenue: v?.revenue ?? 0, orders: v?.orders ?? 0 });
    if (g === "month") cur.setMonth(cur.getMonth() + 1);
    else cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function getSalesStats(opts: {
  from?: Date;
  to?: Date;
  granularity: Granularity;
  paymentMethod?: PaymentMethod;
}): Promise<SalesStats> {
  const { from, granularity, paymentMethod } = opts;
  const now = new Date();
  const to = opts.to ?? now;
  const createdRange = from ? { gte: from, lte: to } : { lte: to };

  const paidWhere: Prisma.OrderWhereInput = {
    status: { in: PAID },
    createdAt: createdRange,
    ...(paymentMethod ? { paymentMethod } : {}),
  };

  const statusWhere: Prisma.OrderWhereInput = {
    createdAt: createdRange,
    ...(paymentMethod ? { paymentMethod } : {}),
  };

  const [paid, statusGroups, prevAgg] = await Promise.all([
    prisma.order.findMany({
      where: paidWhere,
      select: {
        createdAt: true,
        total: true,
        paymentMethod: true,
        customerEmail: true,
        couponDiscount: true,
        zipDiscount: true,
        shippingCost: true,
        shippingMethod: { select: { name: true } },
        shippingName: true,
        items: { select: { name: true, price: true, quantity: true } },
      },
    }),
    prisma.order.groupBy({ by: ["status"], where: statusWhere, _count: true }),
    from
      ? prisma.order.aggregate({
          where: {
            status: { in: PAID },
            createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lt: from },
            ...(paymentMethod ? { paymentMethod } : {}),
          },
          _sum: { total: true },
        })
      : Promise.resolve(null),
  ]);

  let revenue = 0;
  let units = 0;
  let discounts = 0;
  let shipping = 0;
  let earliest: Date | null = null;
  const emails = new Set<string>();
  const payMap = new Map<PaymentMethod, { count: number; revenue: number }>();
  const shipMap = new Map<string, { count: number; revenue: number }>();
  const prodMap = new Map<string, { quantity: number; revenue: number }>();
  const bucketMap = new Map<string, { revenue: number; orders: number }>();

  for (const o of paid) {
    revenue += o.total;
    discounts += o.couponDiscount + o.zipDiscount;
    shipping += o.shippingCost;
    emails.add(o.customerEmail);
    if (!earliest || o.createdAt < earliest) earliest = o.createdAt;

    const pm = payMap.get(o.paymentMethod) ?? { count: 0, revenue: 0 };
    pm.count += 1;
    pm.revenue += o.total;
    payMap.set(o.paymentMethod, pm);

    const sName = o.shippingName ?? o.shippingMethod?.name ?? "Sin envío";
    const sm = shipMap.get(sName) ?? { count: 0, revenue: 0 };
    sm.count += 1;
    sm.revenue += o.total;
    shipMap.set(sName, sm);

    for (const it of o.items) {
      units += it.quantity;
      const p = prodMap.get(it.name) ?? { quantity: 0, revenue: 0 };
      p.quantity += it.quantity;
      p.revenue += it.price * it.quantity;
      prodMap.set(it.name, p);
    }

    const key = bucketKey(o.createdAt, granularity);
    const b = bucketMap.get(key) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total;
    b.orders += 1;
    bucketMap.set(key, b);
  }

  const paidOrders = paid.length;
  const seriesStart = from ?? earliest ?? now;
  const prevRevenue = prevAgg?._sum.total ?? null;

  return {
    revenue,
    paidOrders,
    avgTicket: paidOrders > 0 ? revenue / paidOrders : 0,
    units,
    customers: emails.size,
    discounts,
    shipping,
    revenueDelta: prevRevenue && prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null,
    pendingOrders: statusGroups.find((g) => g.status === "pending")?._count ?? 0,
    cancelledOrders: statusGroups.find((g) => g.status === "cancelled")?._count ?? 0,
    totalOrders: statusGroups.reduce((sum, g) => sum + g._count, 0),
    byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count })).sort((a, b) => b.count - a.count),
    byPayment: [...payMap]
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byShipping: [...shipMap].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue),
    topProducts: [...prodMap]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8),
    series: buildSeries(seriesStart, to, granularity, bucketMap),
  };
}
