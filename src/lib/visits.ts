import { prisma } from "@/lib/prisma";

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export type Granularity = "hour" | "day" | "month";

export type VisitStats = {
  visits: number; // sesiones distintas en el período
  pageViews: number; // filas totales (recargas/navegación incluidas)
  topPages: { path: string; count: number }[];
  topCartProducts: { name: string; quantity: number }[];
  series: { label: string; count: number }[];
  // Origen de las visitas: la primera llegada de cada visitante en el período
  sources: { channel: string; paid: boolean; count: number }[];
  noSource: number; // visitas sin dato de origen (anteriores a esta función)
  campaigns: { campaign: string; channel: string; paid: boolean; count: number }[];
  referrerHosts: { host: string; count: number }[];
};

function bucketKey(d: Date, g: Granularity): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (g === "month") return `${y}-${m}`;
  if (g === "hour") return `${y}-${m}-${day}-${String(d.getHours()).padStart(2, "0")}`;
  return `${y}-${m}-${day}`;
}

function buildSeries(start: Date, end: Date, g: Granularity, map: Map<string, number>): VisitStats["series"] {
  const out: VisitStats["series"] = [];
  const cur =
    g === "month"
      ? new Date(start.getFullYear(), start.getMonth(), 1)
      : g === "hour"
        ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours())
        : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last =
    g === "month"
      ? new Date(end.getFullYear(), end.getMonth(), 1)
      : g === "hour"
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), end.getHours())
        : new Date(end.getFullYear(), end.getMonth(), end.getDate());

  let guard = 0;
  while (cur <= last && guard++ < 400) {
    const label =
      g === "month" ? MONTH_LABELS[cur.getMonth()] : g === "hour" ? `${cur.getHours()}h` : `${cur.getDate()}/${cur.getMonth() + 1}`;
    out.push({ label, count: map.get(bucketKey(cur, g)) ?? 0 });
    if (g === "month") cur.setMonth(cur.getMonth() + 1);
    else if (g === "hour") cur.setHours(cur.getHours() + 1);
    else cur.setDate(cur.getDate() + 1);
  }
  return out;
}

type CartItemJson = { productId: string | null; name: string; price: number; quantity: number };

// `to` es opcional (por defecto ahora mismo) para poder elegir cualquier
// rango, no solo "desde tal fecha hasta hoy" — ver VisitFilters, que arma
// from/to libres además de los atajos rápidos (7 días, hoy, etc.).
export async function getVisitStats(opts: { from?: Date; to?: Date; granularity: Granularity }): Promise<VisitStats> {
  const { from, granularity } = opts;
  const now = new Date();
  const to = opts.to ?? now;
  const createdAt: { gte?: Date; lte?: Date } = { lte: to };
  if (from) createdAt.gte = from;
  const where = { createdAt };

  const [pageViews, distinctSessions, pathGroups] = await Promise.all([
    prisma.pageView.count({ where }),
    prisma.pageView.findMany({ where, distinct: ["sessionId"], select: { sessionId: true } }),
    prisma.pageView.groupBy({ by: ["path"], where, _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
  ]);

  const rows = await prisma.pageView.findMany({ where, select: { createdAt: true } });
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = bucketKey(r.createdAt, granularity);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const series = buildSeries(from ?? (rows[0]?.createdAt ?? to), to, granularity, map);

  // "Productos más agregados al carrito": combina lo que hoy sigue en un
  // carrito sin comprar (AbandonedCart, foto actual) con lo que efectivamente
  // se compró (OrderItem, permanente) — así no es solo "lo que se vendió"
  // (eso ya lo muestra Estadísticas), sino una señal más amplia de interés.
  const [abandonedCarts, orderItems] = await Promise.all([
    prisma.abandonedCart.findMany({
      where: { lastActive: { ...(from ? { gte: from } : {}), lte: to } },
      select: { items: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { ...(from ? { gte: from } : {}), lte: to } } },
      select: { productId: true, name: true, quantity: true },
    }),
  ]);

  const productMap = new Map<string, { name: string; quantity: number }>();
  for (const cart of abandonedCarts) {
    const items = Array.isArray(cart.items) ? (cart.items as unknown as CartItemJson[]) : [];
    for (const item of items) {
      if (!item.productId) continue;
      const cur = productMap.get(item.productId);
      productMap.set(item.productId, { name: item.name, quantity: (cur?.quantity ?? 0) + item.quantity });
    }
  }
  for (const item of orderItems) {
    if (!item.productId) continue;
    const cur = productMap.get(item.productId);
    productMap.set(item.productId, { name: item.name, quantity: (cur?.quantity ?? 0) + item.quantity });
  }
  const topCartProducts = [...productMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

  // Origen: de cada visitante (sesión) se toma su primera llegada dentro del período
  const landings = await prisma.pageView.findMany({
    where: { ...where, isLanding: true },
    orderBy: { createdAt: "asc" },
    select: { sessionId: true, channel: true, paid: true, campaign: true, referrerHost: true },
  });
  const firstBySession = new Map<string, (typeof landings)[number]>();
  for (const l of landings) if (!firstBySession.has(l.sessionId)) firstBySession.set(l.sessionId, l);
  const srcMap = new Map<string, { channel: string; paid: boolean; count: number }>();
  const campMap = new Map<string, { campaign: string; channel: string; paid: boolean; count: number }>();
  const hostMap = new Map<string, number>();
  for (const l of firstBySession.values()) {
    const channel = l.channel ?? "directo";
    const key = `${channel}|${l.paid}`;
    srcMap.set(key, { channel, paid: l.paid, count: (srcMap.get(key)?.count ?? 0) + 1 });
    if (l.campaign) {
      const ck = `${l.campaign}|${channel}|${l.paid}`;
      campMap.set(ck, { campaign: l.campaign, channel, paid: l.paid, count: (campMap.get(ck)?.count ?? 0) + 1 });
    }
    if (l.referrerHost && channel === "sitio") hostMap.set(l.referrerHost, (hostMap.get(l.referrerHost) ?? 0) + 1);
  }
  const noSource = Math.max(0, distinctSessions.length - firstBySession.size);

  return {
    sources: [...srcMap.values()].sort((a, b) => b.count - a.count),
    noSource,
    campaigns: [...campMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    referrerHosts: [...hostMap.entries()].map(([host, count]) => ({ host, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    visits: distinctSessions.length,
    pageViews,
    topPages: pathGroups.map((g) => ({ path: g.path, count: g._count.path })).sort((a, b) => b.count - a.count),
    topCartProducts,
    series,
  };
}
