// Cálculos puros (sin base de datos) de las métricas comerciales. Se separan de lib/insights.ts para poder probarlos.

export type PaidOrder = { id: string; email: string; total: number; createdAt: Date; couponId: string | null; couponDiscount: number };
export type SearchRow = { term: string; resultsCount: number };
export type CouponInfo = { id: string; code: string };

const DAY = 24 * 60 * 60 * 1000;
const rate = (a: number, b: number) => (b > 0 ? a / b : null);

export function conversion(sessions: number, cartsStarted: number, paidOrders: number) {
  return {
    sessions,
    cartsStarted,
    paidOrders,
    // Porcentajes sobre 1 (0.032 = 3,2 %); null si no hay base para calcular
    orderRate: rate(paidOrders, sessions),
    cartRate: rate(cartsStarted, sessions),
    cartToOrderRate: rate(Math.min(paidOrders, cartsStarted || paidOrders), cartsStarted),
  };
}

// Compradores del período y cuántos ya habían comprado antes (recurrentes)
export function customerMetrics(rangeOrders: PaidOrder[], emailsWithEarlierPurchase: Set<string>, allPaidOrders: Pick<PaidOrder, "email" | "createdAt">[]) {
  const buyers = new Set(rangeOrders.map((o) => o.email.toLowerCase()));
  const returning = [...buyers].filter((e) => emailsWithEarlierPurchase.has(e));

  // Promedio de días entre compras, entre los clientes con 2 compras o más (histórico)
  const byEmail = new Map<string, number[]>();
  for (const o of allPaidOrders) {
    const key = o.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), o.createdAt.getTime()]);
  }
  const gaps: number[] = [];
  for (const times of byEmail.values()) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    gaps.push((times[times.length - 1] - times[0]) / (times.length - 1) / DAY);
  }
  return {
    buyers: buyers.size,
    returningBuyers: returning.length,
    firstTimeBuyers: buyers.size - returning.length,
    repeatRate: rate(returning.length, buyers.size),
    avgDaysBetweenPurchases: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    repeatCustomersAllTime: gaps.length,
  };
}

export function aggregateSearches(rows: SearchRow[], limit = 10) {
  const byTerm = new Map<string, { count: number; results: number; zero: number }>();
  for (const r of rows) {
    const e = byTerm.get(r.term) ?? { count: 0, results: 0, zero: 0 };
    e.count++;
    e.results += r.resultsCount;
    if (r.resultsCount === 0) e.zero++;
    byTerm.set(r.term, e);
  }
  const all = [...byTerm].map(([term, e]) => ({ term, count: e.count, avgResults: e.results / e.count, withoutResults: e.zero }));
  return {
    total: rows.length,
    distinct: all.length,
    withoutResults: rows.filter((r) => r.resultsCount === 0).length,
    top: [...all].sort((a, b) => b.count - a.count || a.term.localeCompare(b.term)).slice(0, limit),
    // Lo que buscan y no encuentran: las oportunidades de surtido
    noResults: all.filter((t) => t.withoutResults > 0).sort((a, b) => b.withoutResults - a.withoutResults || a.term.localeCompare(b.term)).slice(0, limit),
  };
}

export function aggregateCoupons(orders: PaidOrder[], coupons: CouponInfo[]) {
  const codes = new Map(coupons.map((c) => [c.id, c.code]));
  const by = new Map<string, { uses: number; revenue: number; discount: number }>();
  let withCoupon = 0;
  for (const o of orders) {
    if (!o.couponId) continue;
    withCoupon++;
    const e = by.get(o.couponId) ?? { uses: 0, revenue: 0, discount: 0 };
    e.uses++;
    e.revenue += o.total;
    e.discount += o.couponDiscount;
    by.set(o.couponId, e);
  }
  return {
    ordersWithCoupon: withCoupon,
    couponShare: rate(withCoupon, orders.length),
    discountGiven: [...by.values()].reduce((s, e) => s + e.discount, 0),
    perCoupon: [...by]
      .map(([id, e]) => ({ code: codes.get(id) ?? "(cupón eliminado)", uses: e.uses, revenue: e.revenue, discount: e.discount, avgTicket: e.revenue / e.uses }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

// Cambio porcentual entre dos períodos (null si no hay base)
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Período inmediatamente anterior, de igual duración
export function previousRange(r: { from: Date; to: Date }): { from: Date; to: Date } {
  const ms = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - ms - 1), to: new Date(r.from.getTime() - 1) };
}

// "/producto/mi-taza" -> "mi-taza" (null si no es una ficha de producto)
export function productSlugFromPath(path: string): string | null {
  const m = /^\/producto\/([^/?#]+)/.exec(path);
  return m ? decodeURIComponent(m[1]) : null;
}
