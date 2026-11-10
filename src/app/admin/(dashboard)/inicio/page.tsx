import { formatMoneyWith } from "@/lib/money";
import Link from "next/link";
import { getDashboardStats } from "@/lib/dashboard";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/sales";
import { StatCard } from "@/components/admin/StatCard";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { Badge } from "@/components/admin/Badge";
import { QuickCouponGenerator } from "../cupones/QuickCouponGenerator";
import {
  SalesIcon,
  ClockIcon,
  UsersIcon,
  CartIcon,
  BellIcon,
  MailIcon,
  StarIcon,
  TagIcon,
  PackageIcon,
  AlertIcon,
  CheckCircleIcon,
  TrendUpIcon,
  WrenchIcon,
} from "@/components/icons";

const STATUS_TONES: Record<string, "amber" | "green" | "red"> = {
  pending: "amber",
  confirmed: "green",
  cancelled: "red",
};

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default async function AdminInicioPage() {
  const stats = await getDashboardStats();

  const maxPaymentTotal = Math.max(1, ...stats.ordersByPaymentMethod.map((p) => p._sum.total ?? 0));
  const totalOrdersForBreakdown = stats.pendingOrdersCount + stats.confirmedOrdersCount + stats.cancelledOrdersCount || 1;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="flex shrink-0 items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-ink">Hola, {stats.userLabel}</h1>
        <p className="shrink-0 text-sm text-brand-muted">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} — así viene la
          tienda.
        </p>
      </div>

      {stats.maintenanceMode && (
        <Link
          href="/admin/configuracion"
          className="mt-4 flex shrink-0 items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 transition-colors hover:bg-amber-100"
        >
          <WrenchIcon className="h-5 w-5 shrink-0" />
          <span>
            <span className="font-semibold">El sitio está en modo mantenimiento</span> — los clientes solo ven la
            pantalla de "volvemos enseguida". Tocá acá para apagarlo.
          </span>
        </Link>
      )}

      {/* Alertas relevantes */}
      {stats.alerts.length > 0 && (
        <div className="mt-4 shrink-0 rounded-xl border border-black/10 bg-white p-4">
          <p className="text-sm font-semibold text-brand-ink">Requiere tu atención</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {stats.alerts.map((a) => (
              <li key={a.text}>
                <Link
                  href={a.href}
                  className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    a.level === "critical"
                      ? "bg-red-50 text-red-800 hover:bg-red-100"
                      : a.level === "warning"
                        ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                        : "bg-brand-soft/60 text-brand-ink hover:bg-brand-soft"
                  }`}
                >
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{a.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cupón rápido para invitar a probar la tienda online a quien compró en el local */}
      <div className="mt-4 shrink-0">
        <QuickCouponGenerator />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          icon={SalesIcon}
          tone="pink"
          label="Ventas este mes"
          value={formatMoneyWith(stats.revenueThisMonth, stats.currency)}
          hint={
            stats.revenueTrendPct !== null
              ? `${stats.revenueTrendPct >= 0 ? "+" : ""}${stats.revenueTrendPct.toFixed(0)}% vs. mes pasado`
              : `${stats.ordersThisMonth} pedidos`
          }
          href="/admin/ventas"
        />
        <StatCard
          icon={ClockIcon}
          tone="amber"
          label="Pedidos pendientes"
          value={String(stats.pendingOrdersCount)}
          hint="Esperando confirmación"
          href="/admin/ventas"
        />
        <StatCard
          icon={UsersIcon}
          tone="neutral"
          label="Usuarios"
          value={String(stats.userCount)}
          hint={`+${stats.newUsersThisWeek} esta semana`}
          href="/admin/usuarios"
        />
        <StatCard
          icon={CartIcon}
          tone="amber"
          label="Carritos abandonados"
          value={String(stats.abandonedCartCount)}
          hint={`${formatMoneyWith(stats.abandonedCartValue, stats.currency)} en juego`}
          href="/admin/carritos-abandonados"
        />
        <StatCard
          icon={BellIcon}
          tone="pink"
          label="Lista de espera"
          value={String(stats.waitlistCount)}
          hint="Esperando stock"
          href="/admin/lista-espera"
        />
        <StatCard
          icon={MailIcon}
          tone="neutral"
          label="Suscriptores"
          value={String(stats.subscriberCount)}
          hint={`${stats.mailCampaignsSentCount} mailings enviados`}
          href="/admin/suscriptores"
        />
      </div>

      {/* Chart */}
      <div className="mt-6 shrink-0 rounded-xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-ink">Ventas de los últimos 14 días</p>
            <p className="text-xs text-brand-muted">Solo pedidos confirmados.</p>
          </div>
          <div className="flex items-center gap-1.5 text-brand-pink-dark">
            <TrendUpIcon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-4">
          <RevenueChart data={stats.chart} currency={stats.currency} />
        </div>
      </div>

      {/* Pedidos recientes + Actividad */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Pedidos recientes</p>
            <Link href="/admin/ventas" className="text-xs font-semibold text-brand-pink-dark hover:underline">
              Ver todos
            </Link>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-black/5">
            {stats.recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-brand-ink">{o.customerName}</p>
                  <p className="text-xs text-brand-muted">
                    {paymentMethodLabel(o.paymentMethod)} · {timeAgo(o.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold text-brand-ink">${o.total.toFixed(0)}</span>
                  <Badge tone={STATUS_TONES[o.status]}>{orderStatusLabel(o.status)}</Badge>
                </div>
              </div>
            ))}
            {stats.recentOrders.length === 0 && (
              <p className="py-6 text-center text-sm text-brand-muted">Todavía no hay pedidos.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Actividad reciente</p>
          <div className="mt-3 flex flex-col divide-y divide-black/5">
            {stats.recentAbandonedCarts.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <CartIcon className="h-3.5 w-3.5" />
                </div>
                <p className="min-w-0 flex-1 truncate text-brand-ink">
                  <span className="font-medium">{c.user?.name ?? c.name ?? c.email ?? "Alguien"}</span> dejó un carrito
                  de ${c.total.toFixed(0)}
                </p>
                <span className="shrink-0 text-xs text-brand-muted">{timeAgo(c.lastActive)}</span>
              </div>
            ))}
            {stats.recentWaitlist.slice(0, 3).map((w) => (
              <div key={w.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink/10 text-brand-pink-dark">
                  <BellIcon className="h-3.5 w-3.5" />
                </div>
                <p className="min-w-0 flex-1 truncate text-brand-ink">
                  <span className="font-medium">{w.name}</span> quiere que avisen de &ldquo;{w.productName}&rdquo;
                </p>
                <span className="shrink-0 text-xs text-brand-muted">{timeAgo(w.createdAt)}</span>
              </div>
            ))}
            {stats.recentAbandonedCarts.length === 0 && stats.recentWaitlist.length === 0 && (
              <p className="py-6 text-center text-sm text-brand-muted">Sin actividad todavía.</p>
            )}
          </div>
        </div>
      </div>

      {/* Medios de pago + Estado de pedidos */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Ventas por medio de pago</p>
          <div className="mt-4 flex flex-col gap-3">
            {stats.ordersByPaymentMethod.map((p) => (
              <div key={p.paymentMethod}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-brand-ink">{paymentMethodLabel(p.paymentMethod)}</span>
                  <span className="text-brand-muted">
                    ${(p._sum.total ?? 0).toFixed(0)} · {p._count} pedidos
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-soft">
                  <div
                    className="h-full rounded-full bg-brand-pink"
                    style={{ width: `${((p._sum.total ?? 0) / maxPaymentTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.ordersByPaymentMethod.length === 0 && (
              <p className="py-4 text-center text-sm text-brand-muted">Sin ventas confirmadas todavía.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Estado de los pedidos</p>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-brand-soft">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${(stats.pendingOrdersCount / totalOrdersForBreakdown) * 100}%` }}
            />
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.confirmedOrdersCount / totalOrdersForBreakdown) * 100}%` }}
            />
            <div
              className="h-full bg-red-400"
              style={{ width: `${(stats.cancelledOrdersCount / totalOrdersForBreakdown) * 100}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Pendientes ({stats.pendingOrdersCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Confirmados ({stats.confirmedOrdersCount})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" /> Cancelados ({stats.cancelledOrdersCount})
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/5 pt-4 text-xs text-brand-muted">
            <p className="flex items-center gap-1.5">
              <StarIcon className="h-3.5 w-3.5 text-brand-pink-dark" /> {stats.pointsIssued} pts otorgados
            </p>
            <p className="flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5 text-brand-pink-dark" /> {stats.activeCouponsCount} cupones activos
            </p>
          </div>
        </div>
      </div>

      {/* Promociones activas + Mejores clientes */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Promociones activas</p>
            <Link href="/admin/cupones" className="text-xs font-semibold text-brand-pink-dark hover:underline">Ver cupones</Link>
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            {stats.promotions.activeCouponsTotal} cupón(es) vigentes · {stats.promotions.promoProducts} producto(s) con precio promocional
          </p>
          <div className="mt-3 flex flex-col divide-y divide-black/5">
            {stats.promotions.activeCoupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <p className="text-brand-ink">
                  <b>{c.code}</b>{" "}
                  <span className="text-brand-muted">{c.discountType === "percentage" ? `${c.discountValue}%` : c.discountType === "free_shipping" ? "Envío gratis" : formatMoneyWith(c.discountValue, stats.currency)} off</span>
                </p>
                <span className="shrink-0 text-xs text-brand-muted">
                  {c.usedCount}{c.maxUses ? `/${c.maxUses}` : ""} usos{c.expiresAt ? ` · vence ${c.expiresAt.toLocaleDateString("es-AR")}` : ""}
                </span>
              </div>
            ))}
            {stats.promotions.activeCoupons.length === 0 && <p className="py-4 text-center text-sm text-brand-muted">No hay cupones vigentes.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Mejores clientes</p>
            <Link href="/admin/usuarios?sort=spent" className="text-xs font-semibold text-brand-pink-dark hover:underline">Ver clientes</Link>
          </div>
          <p className="mt-1 text-xs text-brand-muted">{stats.frequentCustomers} cliente(s) frecuentes (3 compras o más)</p>
          <div className="mt-3 flex flex-col divide-y divide-black/5">
            {stats.bestCustomers.map((c) => (
              <Link key={c.id} href={`/admin/usuarios/${c.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand-pink-dark">
                <p className="truncate text-brand-ink">{c.name}</p>
                <span className="shrink-0 text-xs text-brand-muted">{c.orders} compra(s) · <b className="text-brand-ink">{formatMoneyWith(c.spent, stats.currency)}</b></span>
              </Link>
            ))}
            {stats.bestCustomers.length === 0 && <p className="py-4 text-center text-sm text-brand-muted">Todavía no hay compras pagadas.</p>}
          </div>
        </div>
      </div>

      {/* Stock bajo + Estado del sistema */}
      <div className="mt-6 mb-2 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-ink">Stock bajo</p>
            <Link href="/admin/productos?sort=stock" className="text-xs font-semibold text-brand-pink-dark hover:underline">
              Ver productos
            </Link>
          </div>
          {stats.health.catalogOk ? (
            <>
              <p className="mt-1 text-xs text-brand-muted">
                {stats.totalProducts} productos en el catálogo · {stats.outOfStockCount} sin stock
              </p>
              <div className="mt-3 flex flex-col divide-y divide-black/5">
                {stats.lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <p className="truncate text-brand-ink">{p.name}</p>
                    <Badge tone={p.stock <= 3 ? "amber" : "neutral"}>{p.stock} u.</Badge>
                  </div>
                ))}
                {stats.lowStockProducts.length === 0 && (
                  <p className="py-4 text-center text-sm text-brand-muted">Todo con buen stock.</p>
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Todavía no hay productos cargados — cargalos desde Productos o migralos desde WooCommerce.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Estado del sistema</p>
          <div className="mt-3 flex flex-col divide-y divide-black/5">
            {[
              { ok: stats.health.catalogOk, label: "Catálogo con productos", href: "/admin/productos" },
              { ok: stats.health.smtpOk, label: "Mailing (SMTP)", href: "/admin/configuracion" },
              { ok: stats.health.pointsEnabled, label: "Sistema de puntos activo", href: "/admin/puntos" },
              { ok: stats.health.heroSlideCount > 0, label: "Slider del home cargado", href: "/admin/configuracion" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-brand-pink-dark"
              >
                <span className="flex items-center gap-2 text-brand-ink">
                  {item.ok ? (
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <AlertIcon className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  {item.label}
                </span>
                <span className={`text-xs font-semibold ${item.ok ? "text-green-700" : "text-amber-700"}`}>
                  {item.ok ? "OK" : "Falta configurar"}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 border-t border-black/5 pt-4 text-xs text-brand-muted">
            <PackageIcon className="h-3.5 w-3.5" />
            {stats.pointsRedeemed} pts canjeados en total
          </div>
        </div>
      </div>
    </div>
  );
}
