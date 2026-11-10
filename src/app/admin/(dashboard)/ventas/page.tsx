import { getSalesPage } from "@/lib/sales";
import { dayToInstant } from "@/lib/storeTime";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { Pagination } from "@/components/Pagination";
import { SalesTable } from "./SalesTable";
import { MarkSeen } from "./MarkSeen";
import { SalesFilters } from "./SalesFilters";

const PAGE_SIZE = 25;

const VALID_STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];
const VALID_PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];

export default async function AdminVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; payment?: string; status?: string; productId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() || undefined;
  const paymentMethod = VALID_PAYMENTS.includes(params.payment as PaymentMethod)
    ? (params.payment as PaymentMethod)
    : undefined;
  const status = VALID_STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;
  const productId = params.productId || undefined;
  const from = dayToInstant(params.from);
  const to = dayToInstant(params.to, true);

  const { orders, total } = await getSalesPage({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    q,
    paymentMethod,
    status,
    productId,
    from,
    to,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(q || paymentMethod || status || productId || from || to);
  const exportQuery = new URLSearchParams(
    Object.entries({ q, payment: paymentMethod, status, productId, from: params.from, to: params.to }).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Ventas</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {filtered ? `${total} pedidos encontrados` : `${total} pedidos hechos desde la tienda online.`}
        </p>
        {productId && (
          <p className="mt-1 text-sm text-brand-muted">
            Mostrando solo pedidos que incluyen este producto (así ves cuál está reteniendo el stock).{" "}
            <a href="/admin/ventas" className="font-medium text-brand-pink-dark hover:underline">
              Quitar filtro
            </a>
          </p>
        )}
        <SalesFilters />
        <a
          href={`/api/admin/orders/export${exportQuery ? `?${exportQuery}` : ""}`}
          className="mt-3 inline-block rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
        >
          Exportar a planilla (CSV)
        </a>
      </div>

      <MarkSeen ids={orders.filter((o) => !o.adminSeenAt).map((o) => o.id)} />
      <SalesTable orders={orders} />

      <div className="shrink-0">
        <Pagination
          basePath="/admin/ventas"
          query={q}
          extraParams={{ payment: paymentMethod, status, productId: params.productId, from: params.from, to: params.to }}
          currentPage={page}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
