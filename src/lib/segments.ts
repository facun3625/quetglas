import type { SegmentType } from "@/generated/prisma/enums";

// Reglas de segmentación de clientes. Son funciones puras (sin base de datos) para poder probarlas.
// Los parámetros de cada segmento los define el admin desde /admin/segmentos.

export type SegmentParams = { days?: number; minOrders?: number; minSpent?: number; minPoints?: number; couponId?: string };
export type ParamKey = keyof SegmentParams;

export type CustomerStats = {
  orders: number; // pedidos pagados (confirmados o entregados)
  spent: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  orderDates: Date[];
  couponIds: string[];
};

export const EMPTY_STATS: CustomerStats = { orders: 0, spent: 0, firstOrderAt: null, lastOrderAt: null, orderDates: [], couponIds: [] };

export type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  role: "customer" | "admin" | "superadmin" | "couponStaff";
  points: number;
  createdAt: Date;
  stats: CustomerStats;
};

export const SEGMENT_TYPES: Record<
  SegmentType,
  { label: string; description: string; fields: { key: ParamKey; label: string; min?: number }[]; defaults: SegmentParams }
> = {
  new_customers: {
    label: "Clientes nuevos",
    description: "Se registraron hace poco.",
    fields: [{ key: "days", label: "Registrados en los últimos (días)", min: 1 }],
    defaults: { days: 30 },
  },
  frequent: {
    label: "Clientes frecuentes",
    description: "Compraron varias veces (en el período indicado, o siempre si el período es 0).",
    fields: [
      { key: "minOrders", label: "Mínimo de compras", min: 1 },
      { key: "days", label: "En los últimos (días, 0 = siempre)", min: 0 },
    ],
    defaults: { minOrders: 3, days: 0 },
  },
  high_spend: {
    label: "Nivel de gasto",
    description: "Gastaron al menos un monto en total.",
    fields: [{ key: "minSpent", label: "Gasto total mínimo", min: 0 }],
    defaults: { minSpent: 100000 },
  },
  inactive: {
    label: "Hace tiempo que no compran",
    description: "Compraron alguna vez, pero no en el último tiempo.",
    fields: [{ key: "days", label: "Sin comprar hace más de (días)", min: 1 }],
    defaults: { days: 90 },
  },
  never_purchased: {
    label: "Registrados sin compras",
    description: "Tienen cuenta pero nunca compraron.",
    fields: [{ key: "days", label: "Registrados hace más de (días, 0 = cualquiera)", min: 0 }],
    defaults: { days: 7 },
  },
  with_points: {
    label: "Con puntos disponibles",
    description: "Tienen puntos para canjear.",
    fields: [{ key: "minPoints", label: "Puntos mínimos", min: 1 }],
    defaults: { minPoints: 100 },
  },
  from_coupon: {
    label: "Provenientes de una promoción",
    description: "Compraron usando un cupón (uno puntual o cualquiera).",
    fields: [],
    defaults: {},
  },
};

const DAY = 24 * 60 * 60 * 1000;

export function matchesSegment(type: SegmentType, params: SegmentParams, c: CustomerRow, now = new Date()): boolean {
  const days = params.days ?? 0;
  switch (type) {
    case "new_customers":
      return c.createdAt.getTime() >= now.getTime() - (days || 30) * DAY;
    case "frequent": {
      const dates = days > 0 ? c.stats.orderDates.filter((d) => d.getTime() >= now.getTime() - days * DAY) : c.stats.orderDates;
      return dates.length >= (params.minOrders ?? 3);
    }
    case "high_spend":
      return c.stats.spent >= (params.minSpent ?? 0) && c.stats.orders > 0;
    case "inactive":
      return c.stats.orders > 0 && c.stats.lastOrderAt !== null && c.stats.lastOrderAt.getTime() < now.getTime() - (days || 90) * DAY;
    case "never_purchased":
      return c.stats.orders === 0 && c.createdAt.getTime() <= now.getTime() - days * DAY;
    case "with_points":
      return c.points >= (params.minPoints ?? 1);
    case "from_coupon":
      return params.couponId ? c.stats.couponIds.includes(params.couponId) : c.stats.couponIds.length > 0;
  }
}

export function segmentSummary(type: SegmentType, params: SegmentParams, couponCode?: string | null): string {
  switch (type) {
    case "new_customers": return `Registrados en los últimos ${params.days ?? 30} días`;
    case "frequent": return `${params.minOrders ?? 3}+ compras${params.days ? ` en los últimos ${params.days} días` : ""}`;
    case "high_spend": return `Gasto total de ${params.minSpent ?? 0} o más`;
    case "inactive": return `Sin comprar hace más de ${params.days ?? 90} días`;
    case "never_purchased": return `Sin compras${params.days ? `, registrados hace más de ${params.days} días` : ""}`;
    case "with_points": return `${params.minPoints ?? 1}+ puntos`;
    case "from_coupon": return couponCode ? `Usaron el cupón ${couponCode}` : "Usaron algún cupón";
  }
}

// Promedio de días entre compras (null si hay menos de 2)
export function averageDaysBetween(dates: Date[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  return (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / (sorted.length - 1) / DAY;
}
