import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomerRows } from "@/lib/customers";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orderNumber";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";
import { averageDaysBetween, matchesSegment, segmentSummary, type SegmentParams } from "@/lib/segments";
import { PointsAdjustForm } from "../PointsAdjustForm";

export const dynamic = "force-dynamic";

// Días transcurridos desde una fecha (fuera del render para no depender de la hora en cada pasada)
function daysBetween(date: Date): number {
  return Math.floor((new Date().getTime() - date.getTime()) / 86400000);
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 text-xl font-bold text-brand-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>}
    </div>
  );
}

export default async function CustomerFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, phone: true, points: true, createdAt: true, passwordHash: true, wooId: true },
  });
  // El superadministrador no existe para el administrador de la tienda
  if (!user || (user.role === "superadmin" && (await auth())?.user?.role !== "superadmin")) notFound();

  const [{ currency }, rows, segments, orders, pointTx, coupons, favorites, cart, pushDevices, chats] = await Promise.all([
    getStoreSettingsRow(),
    getCustomerRows({ onlyUserIds: [id], includeAdmins: true, includeSuperAdmin: true }),
    prisma.customerSegment.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
    prisma.order.findMany({
      where: { OR: [{ userId: id }, { customerEmail: { equals: user.email, mode: "insensitive" } }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { coupon: { select: { code: true } } },
    }),
    prisma.pointTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.coupon.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.favorite.count({ where: { userId: id } }),
    prisma.abandonedCart.findFirst({ where: { userId: id }, orderBy: { lastActive: "desc" } }),
    prisma.pushSubscription.count({ where: { userId: id } }),
    prisma.aiConversation.count({ where: { userId: id } }),
  ]);
  const fm = (n: number) => formatMoneyWith(n, currency);
  const row = rows[0];
  const stats = row.stats;
  const avgDays = averageDaysBetween(stats.orderDates);
  const daysSince = stats.lastOrderAt ? daysBetween(stats.lastOrderAt) : null;
  const inSegments = segments.filter((s) => matchesSegment(s.type, (s.params ?? {}) as SegmentParams, row));
  const usedCoupons = orders.filter((o) => o.coupon && o.status !== "cancelled");
  const cartItems = Array.isArray(cart?.items) ? (cart!.items as unknown as { name: string; quantity: number }[]) : [];

  return (
    <div className="max-w-5xl pb-16">
      <Link href="/admin/usuarios" className="text-xs text-brand-muted hover:text-brand-pink-dark">← Clientes</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{user.name ?? user.email}</h1>
          <p className="text-sm text-brand-muted">
            {user.email}{user.phone ? ` · ${user.phone}` : ""} · cliente desde {user.createdAt.toLocaleDateString("es-AR")}
            {user.wooId ? " · migrado desde WooCommerce" : ""}
            {!user.passwordHash ? " · sin contraseña (entra con Google o todavía no la creó)" : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.role !== "customer" ? "bg-brand-pink/10 text-brand-pink-dark" : "bg-gray-100 text-gray-700"}`}>
          {user.role === "superadmin" ? "Superadministrador" : user.role === "admin" ? "Administrador" : user.role === "couponStaff" ? "Cupón rápido" : "Cliente"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card label="Compras" value={String(stats.orders)} hint="pagadas" />
        <Card label="Gasto total" value={fm(stats.spent)} />
        <Card label="Ticket promedio" value={stats.orders ? fm(stats.spent / stats.orders) : "—"} />
        <Card label="Frecuencia" value={avgDays === null ? "—" : `cada ${Math.round(avgDays)} d`} hint="entre compras" />
        <Card label="Última compra" value={daysSince === null ? "—" : daysSince === 0 ? "hoy" : `hace ${daysSince} d`} hint={stats.lastOrderAt?.toLocaleDateString("es-AR")} />
        <Card label="Puntos" value={String(user.points)} />
      </div>

      <section className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-semibold text-brand-ink">Segmentos</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {inSegments.map((s) => (
            <span key={s.id} title={segmentSummary(s.type, (s.params ?? {}) as SegmentParams)} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">{s.name}</span>
          ))}
          {inSegments.length === 0 && <span className="text-sm text-brand-muted">No está en ningún segmento.</span>}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <h2 className="font-semibold text-brand-ink">Pedidos ({orders.length})</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-black/5 last:border-0">
                  <td className="py-2 font-semibold"><Link href={`/admin/ventas?q=${o.number}`} className="text-brand-pink-dark hover:underline">{formatOrderNumber(o.number)}</Link></td>
                  <td className="py-2 text-brand-muted">{o.createdAt.toLocaleDateString("es-AR")}</td>
                  <td className="py-2 text-brand-muted">{paymentMethodLabel(o.paymentMethod)}</td>
                  <td className="py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[o.status]}`}>{orderStatusLabel(o.status)}</span></td>
                  <td className="py-2 text-right font-medium text-brand-ink">{fm(o.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td className="py-3 text-brand-muted">Todavía no hizo pedidos.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="font-semibold text-brand-ink">Puntos</h2>
          <p className="text-sm text-brand-muted">Saldo actual: <b className="text-brand-ink">{user.points}</b>. Podés sumar o restar puntos a mano (queda registrado).</p>
          <PointsAdjustForm userId={user.id} />
          <ul className="mt-4 max-h-60 divide-y divide-black/5 overflow-auto text-sm">
            {pointTx.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2">
                <span className="text-brand-ink">{t.description}<span className="block text-xs text-brand-muted">{t.createdAt.toLocaleDateString("es-AR")}</span></span>
                <span className={`font-semibold ${t.amount >= 0 ? "text-green-700" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</span>
              </li>
            ))}
            {pointTx.length === 0 && <li className="py-2 text-brand-muted">Sin movimientos.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-black/10 bg-white p-5">
          <h2 className="font-semibold text-brand-ink">Beneficios utilizados</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {usedCoupons.map((o) => (
              <li key={o.id} className="text-brand-ink">Cupón <b>{o.coupon!.code}</b> en el pedido {formatOrderNumber(o.number)} <span className="text-brand-muted">(−{fm(o.couponDiscount)})</span></li>
            ))}
            {coupons.map((c) => (
              <li key={c.id} className="text-brand-muted">Cupón personal {c.code} — {c.enabled ? "disponible" : "usado"}</li>
            ))}
            {usedCoupons.length === 0 && coupons.length === 0 && <li className="text-brand-muted">Todavía no usó cupones.</li>}
          </ul>
          <h2 className="mt-5 font-semibold text-brand-ink">Comportamiento</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-brand-muted">
            <li>{favorites} producto(s) favorito(s)</li>
            <li>Carrito pendiente: {cartItems.length > 0 ? `${cartItems.reduce((n, i) => n + i.quantity, 0)} unidad(es), ${fm(cart!.total)} (${cart!.lastActive.toLocaleDateString("es-AR")})` : "ninguno"}</li>
            <li>{pushDevices} dispositivo(s) con avisos activados</li>
            <li>{chats} conversación(es) con la vendedora virtual</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
