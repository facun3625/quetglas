import { prisma } from "@/lib/prisma";
import { EMPTY_STATS, matchesSegment, type CustomerRow, type CustomerStats, type SegmentParams } from "@/lib/segments";
import type { SegmentType } from "@/generated/prisma/enums";

// Estadísticas de compra por cliente. Una compra "cuenta" cuando está confirmada o entregada (pago aceptado).
// También se suman las compras hechas como invitado con el mismo email que la cuenta.
const PAID = ["confirmed", "delivered"] as const;

export async function getCustomerRows(opts: { onlyUserIds?: string[]; includeAdmins?: boolean; includeSuperAdmin?: boolean } = {}): Promise<CustomerRow[]> {
  const onlyUserIds = opts.onlyUserIds;
  const users = await prisma.user.findMany({
    // El superadministrador solo lo ve otro superadministrador
    where: { ...(opts.includeAdmins ? (opts.includeSuperAdmin ? {} : { role: { not: "superadmin" as const } }) : { role: "customer" as const }), ...(onlyUserIds ? { id: { in: onlyUserIds } } : {}) },
    select: { id: true, email: true, name: true, role: true, points: true, createdAt: true },
  });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const byId = new Set(users.map((u) => u.id));
  const orders = await prisma.order.findMany({
    where: { status: { in: [...PAID] } },
    select: { userId: true, customerEmail: true, total: true, createdAt: true, couponId: true },
  });

  const stats = new Map<string, CustomerStats>();
  for (const o of orders) {
    const uid = (o.userId && byId.has(o.userId) ? o.userId : null) ?? byEmail.get(o.customerEmail.toLowerCase());
    if (!uid) continue;
    const s = stats.get(uid) ?? { ...EMPTY_STATS, orderDates: [], couponIds: [] };
    s.orders += 1;
    s.spent += o.total;
    s.orderDates.push(o.createdAt);
    if (!s.firstOrderAt || o.createdAt < s.firstOrderAt) s.firstOrderAt = o.createdAt;
    if (!s.lastOrderAt || o.createdAt > s.lastOrderAt) s.lastOrderAt = o.createdAt;
    if (o.couponId && !s.couponIds.includes(o.couponId)) s.couponIds.push(o.couponId);
    stats.set(uid, s);
  }
  return users.map((u) => ({ ...u, stats: stats.get(u.id) ?? EMPTY_STATS }));
}

export async function getSegmentMembers(segment: { type: SegmentType; params: unknown }, rows?: CustomerRow[]): Promise<CustomerRow[]> {
  const all = rows ?? (await getCustomerRows());
  const params = (segment.params ?? {}) as SegmentParams;
  return all.filter((c) => matchesSegment(segment.type, params, c));
}

// Emails de los clientes de varios segmentos (para campañas de mail)
export async function getSegmentEmails(segmentIds: string[]): Promise<string[]> {
  if (segmentIds.length === 0) return [];
  const [segments, rows] = await Promise.all([
    prisma.customerSegment.findMany({ where: { id: { in: segmentIds }, enabled: true } }),
    getCustomerRows(),
  ]);
  const emails = new Set<string>();
  for (const seg of segments) for (const c of await getSegmentMembers(seg, rows)) emails.add(c.email);
  return [...emails];
}

const DEFAULT_SEGMENTS: { name: string; type: SegmentType; params: SegmentParams }[] = [
  { name: "Clientes nuevos", type: "new_customers", params: { days: 30 } },
  { name: "Clientes frecuentes", type: "frequent", params: { minOrders: 3, days: 0 } },
  { name: "Inactivos (3 meses)", type: "inactive", params: { days: 90 } },
  { name: "Registrados sin compras", type: "never_purchased", params: { days: 7 } },
  { name: "Con puntos para canjear", type: "with_points", params: { minPoints: 100 } },
];

// La primera vez que se entra, se crean segmentos de ejemplo (editables y borrables)
export async function ensureSegmentsSeeded() {
  if ((await prisma.customerSegment.count()) > 0) return;
  await prisma.customerSegment.createMany({ data: DEFAULT_SEGMENTS.map((s, i) => ({ ...s, sortOrder: i })) });
}
