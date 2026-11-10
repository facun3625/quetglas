import { prisma } from "@/lib/prisma";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import {
  aggregateCoupons,
  aggregateSearches,
  conversion,
  customerMetrics,
  productSlugFromPath,
  type PaidOrder,
} from "@/lib/insightsCalc";

export type Range = { from: Date; to: Date };

const PAID: OrderStatus[] = ["confirmed", "delivered"];

export type Insights = Awaited<ReturnType<typeof getInsights>>;

// Métricas comerciales de un período: embudo, clientes, búsquedas, productos más vistos y cupones.
export async function getInsights(range: Range, opts: { paymentMethod?: PaymentMethod } = {}) {
  const createdAt = { gte: range.from, lte: range.to };

  const [sessionRows, cartsStarted, orders, newCustomers, searches, viewGroups, allPaid] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "sessionId") AS n FROM "PageView" WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}`,
    prisma.funnelEvent.count({ where: { type: "cart", createdAt } }),
    prisma.order.findMany({
      where: { status: { in: PAID }, createdAt, ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}) },
      select: { id: true, customerEmail: true, total: true, createdAt: true, couponId: true, couponDiscount: true },
    }),
    prisma.user.count({ where: { role: "customer", createdAt } }),
    prisma.searchQuery.findMany({ where: { createdAt }, select: { term: true, resultsCount: true }, take: 100_000 }),
    prisma.pageView.groupBy({ by: ["path"], where: { createdAt, path: { startsWith: "/producto/" } }, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 40 }),
    prisma.order.findMany({ where: { status: { in: PAID } }, select: { customerEmail: true, createdAt: true } }),
  ]);

  const paidOrders: PaidOrder[] = orders.map((o) => ({ id: o.id, email: o.customerEmail, total: o.total, createdAt: o.createdAt, couponId: o.couponId, couponDiscount: o.couponDiscount }));
  const sessions = Number(sessionRows[0]?.n ?? 0);

  // Compradores del período que ya habían comprado antes (recurrentes)
  const earlier = new Set<string>();
  const buyers = new Set(paidOrders.map((o) => o.email.toLowerCase()));
  for (const o of allPaid) {
    if (o.createdAt < range.from && buyers.has(o.customerEmail.toLowerCase())) earlier.add(o.customerEmail.toLowerCase());
  }

  // Productos más vistos: path -> slug -> nombre
  const slugViews = new Map<string, number>();
  for (const g of viewGroups) {
    const slug = productSlugFromPath(g.path);
    if (slug) slugViews.set(slug, (slugViews.get(slug) ?? 0) + g._count.path);
  }
  const products = slugViews.size
    ? await prisma.product.findMany({ where: { slug: { in: [...slugViews.keys()] } }, select: { slug: true, name: true } })
    : [];
  const names = new Map(products.map((p) => [p.slug, p.name]));
  const viewedProducts = [...slugViews]
    .map(([slug, views]) => ({ slug, name: names.get(slug) ?? slug, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const couponIds = [...new Set(paidOrders.map((o) => o.couponId).filter((c): c is string => Boolean(c)))];
  const coupons = couponIds.length ? await prisma.coupon.findMany({ where: { id: { in: couponIds } }, select: { id: true, code: true } }) : [];

  const revenue = paidOrders.reduce((s, o) => s + o.total, 0);
  return {
    range,
    revenue,
    paidOrders: paidOrders.length,
    avgTicket: paidOrders.length ? revenue / paidOrders.length : 0,
    funnel: conversion(sessions, cartsStarted, paidOrders.length),
    customers: { newCustomers, ...customerMetrics(paidOrders, earlier, allPaid.map((o) => ({ email: o.customerEmail, createdAt: o.createdAt }))) },
    searches: aggregateSearches(searches),
    viewedProducts,
    coupons: aggregateCoupons(paidOrders, coupons),
  };
}
