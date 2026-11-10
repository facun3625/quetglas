import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/sales";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
};

export default async function MisPedidosPage() {
  const { currency } = await getStoreSettingsRow();
  const fm = (n: number) => formatMoneyWith(n, currency);
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Mis pedidos</h1>
        <p className="mt-2 text-brand-muted">Iniciá sesión para ver tu historial de compras.</p>
      </div>
    );
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true, shippingMethod: true },
  });

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Mis pedidos</h1>
      <p className="mt-1 text-brand-muted">Historial de compras hechas con esta cuenta.</p>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-brand-muted">Todavía no hiciste ningún pedido.</p>
          <Link
            href="/tienda"
            className="mt-4 inline-block rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark"
          >
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-ink">
                    Pedido del {order.createdAt.toLocaleDateString("es-AR")}
                  </p>
                  <p className="text-xs text-brand-muted">
                    {paymentMethodLabel(order.paymentMethod)}
                    {order.shippingName ?? order.shippingMethod?.name ? ` · ${order.shippingName ?? order.shippingMethod?.name}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {orderStatusLabel(order.status)}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-1.5 border-t border-black/5 pt-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <p className="min-w-0 break-words text-brand-ink">
                      {item.name} <span className="text-brand-muted">x{item.quantity}</span>
                    </p>
                    <p className="shrink-0 text-brand-muted">{fm((item.price * item.quantity))}</p>
                  </div>
                ))}
              </div>

              {order.trackingNumber && (
                <p className="mt-4 border-t border-black/5 pt-4 text-sm text-brand-ink">
                  Seguimiento {order.trackingCarrier ?? ""}: <b className="font-mono">{order.trackingNumber}</b>
                  {order.trackingCarrier === "OCA" && (
                    <>
                      {" "}
                      <a href={`https://www.oca.com.ar/seguimiento/?nroEnvio=${encodeURIComponent(order.trackingNumber)}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-pink-dark hover:underline">
                        Ver estado del envío
                      </a>
                    </>
                  )}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
                <p className="text-sm text-brand-muted">Total</p>
                <p className="text-lg font-bold text-brand-pink-dark">{fm(order.total)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
