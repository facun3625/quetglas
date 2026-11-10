import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getCustomerRows, getSegmentMembers } from "@/lib/customers";
import { averageDaysBetween } from "@/lib/segments";
import { toCsv } from "@/lib/csv";
import { isSuperAdmin } from "@/lib/roles";

// Clientes (con sus métricas) a planilla, con los mismos filtros que la pantalla
export async function GET(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim().toLowerCase() ?? "";
  const segmentId = sp.get("segment");
  const rows = await getCustomerRows({ includeAdmins: true, includeSuperAdmin: isSuperAdmin(session.user?.role) });
  const segment = segmentId ? await prisma.customerSegment.findUnique({ where: { id: segmentId } }) : null;
  let users = segment ? await getSegmentMembers(segment, rows) : rows;
  if (q) users = users.filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q));

  const out: (string | number | null)[][] = [["nombre", "email", "rol", "alta", "compras", "gasto_total", "ticket_promedio", "primera_compra", "ultima_compra", "dias_entre_compras", "puntos"]];
  for (const u of users) {
    const days = averageDaysBetween(u.stats.orderDates);
    out.push([
      u.name, u.email, u.role, u.createdAt.toISOString().slice(0, 10), u.stats.orders, Math.round(u.stats.spent * 100) / 100,
      u.stats.orders ? Math.round((u.stats.spent / u.stats.orders) * 100) / 100 : null,
      u.stats.firstOrderAt?.toISOString().slice(0, 10) ?? "", u.stats.lastOrderAt?.toISOString().slice(0, 10) ?? "",
      days === null ? "" : Math.round(days), u.points,
    ]);
  }
  return new Response("﻿" + toCsv(out), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clientes.csv"' } });
}
