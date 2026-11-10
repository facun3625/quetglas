import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureSegmentsSeeded, getCustomerRows, getSegmentMembers } from "@/lib/customers";
import type { SegmentParams } from "@/lib/segments";
import { SegmentForm } from "./SegmentForm";

export const dynamic = "force-dynamic";

export default async function SegmentosPage() {
  await ensureSegmentsSeeded();
  const [segments, coupons, rows] = await Promise.all([
    prisma.customerSegment.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.coupon.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
    getCustomerRows(),
  ]);
  const counts = await Promise.all(segments.map(async (s) => (await getSegmentMembers(s, rows)).length));

  return (
    <div className="max-w-3xl pb-16">
      <h1 className="text-2xl font-bold text-brand-ink">Segmentos de clientes</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Grupos de clientes que se arman solos según su comportamiento. Los podés filtrar en{" "}
        <Link href="/admin/usuarios" className="font-medium text-brand-pink-dark hover:underline">Clientes</Link> y usarlos como
        destinatarios de campañas en Mailing. Una “compra” cuenta cuando el pedido está confirmado o entregado.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {segments.map((s, i) => (
          <SegmentForm
            key={s.id + JSON.stringify(s.params)}
            initial={{ id: s.id, name: s.name, type: s.type, params: (s.params ?? {}) as SegmentParams, enabled: s.enabled }}
            coupons={coupons}
            members={counts[i]}
          />
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-semibold text-brand-ink">Nuevo segmento</h2>
      <SegmentForm initial={{ name: "", type: "frequent", params: { minOrders: 3, days: 0 }, enabled: true }} coupons={coupons} />
    </div>
  );
}
