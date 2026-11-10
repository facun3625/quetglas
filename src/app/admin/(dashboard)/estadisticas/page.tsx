import { getSalesStats, type Granularity } from "@/lib/stats";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { orderStatusLabel, paymentMethodLabel, ORDER_STATUS_STYLES } from "@/lib/orderLabels";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { StatsFilters, PERIODS, type PeriodKey } from "./StatsFilters";
import { getInsights, type Range } from "@/lib/insights";
import { pctChange, previousRange } from "@/lib/insightsCalc";
import { dayToInstant } from "@/lib/storeTime";

const VALID_PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];

function periodToRange(period: PeriodKey): { from?: Date; granularity: Granularity } {
  const now = new Date();
  switch (period) {
    case "7d":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), granularity: "day" };
    case "30d":
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), granularity: "day" };
    case "12m":
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), granularity: "month" };
    case "all":
      return { granularity: "month" };
  }
}

export default async function AdminEstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; payment?: string; from?: string; to?: string; compare?: string }>;
}) {
  const params = await searchParams;
  const { currency } = await getStoreSettingsRow();
  const money = (n: number) => formatMoneyWith(n, currency);
  const period: PeriodKey = params.period && params.period in PERIODS ? (params.period as PeriodKey) : "30d";
  const paymentMethod = VALID_PAYMENTS.includes(params.payment as PaymentMethod)
    ? (params.payment as PaymentMethod)
    : undefined;

  // Rango personalizado (desde/hasta, en hora de la tienda) o período rápido
  const customFrom = dayToInstant(params.from);
  const customTo = dayToInstant(params.to, true);
  const custom = Boolean(customFrom || customTo);
  const preset = periodToRange(period);
  const from = custom ? customFrom : preset.from;
  const to = custom ? customTo : undefined;
  const granularity: Granularity = custom && from && (to ?? new Date()).getTime() - from.getTime() > 120 * 86400_000 ? "month" : custom ? "day" : preset.granularity;
  const stats = await getSalesStats({ from, to, granularity, paymentMethod });

  // Métricas comerciales del mismo período y, si se pidió, del período anterior de igual duración
  const range: Range = { from: from ?? new Date(2000, 0, 1), to: to ?? new Date() };
  const compare = params.compare === "1" && Boolean(from);
  const [insights, prevInsights] = await Promise.all([
    getInsights(range, { paymentMethod }),
    compare ? getInsights(previousRange(range), { paymentMethod }) : Promise.resolve(null),
  ]);
  const vs = (current: number | null, previous: number | null | undefined, digits = 0) => {
    if (!compare || previous === undefined) return null;
    const change = pctChange(current, previous);
    return change === null ? "sin datos del período anterior" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(digits)}% vs. anterior`;
  };
  const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
  const periodLabel = custom ? `${params.from ?? "…"} a ${params.to ?? "hoy"}` : PERIODS[period];

  const maxSeries = Math.max(1, ...stats.series.map((m) => m.revenue));
  const maxProduct = Math.max(1, ...stats.topProducts.map((p) => p.quantity));
  // Con muchas barras (30 días) no entran todas las etiquetas: mostramos una
  // de cada tantas para que no se amontonen.
  const labelStep = Math.max(1, Math.ceil(stats.series.length / 10));

  const kpis: { label: string; value: string; hint: string; accent?: boolean }[] = [
    {
      label: "Ingresos (confirmados)",
      value: money(stats.revenue),
      hint:
        compare && prevInsights
          ? (vs(insights.revenue, prevInsights.revenue) as string)
          : stats.revenueDelta === null
          ? `${stats.paidOrders} pedidos pagados`
          : `${stats.revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(stats.revenueDelta))}% vs. período anterior`,
    },
    { label: "Ticket promedio", value: money(stats.avgTicket), hint: vs(insights.avgTicket, prevInsights?.avgTicket) ?? "por pedido pagado" },
    { label: "Unidades vendidas", value: String(stats.units), hint: "ítems en pedidos pagados" },
    { label: "Clientes", value: String(stats.customers), hint: vs(insights.customers.buyers, prevInsights?.customers.buyers) ?? "compradores distintos" },
    { label: "Pedidos totales", value: String(stats.totalOrders), hint: vs(insights.paidOrders, prevInsights?.paidOrders) ?? "en el período" },
    { label: "Pago pendiente", value: String(stats.pendingOrders), hint: "esperando confirmación", accent: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Estadísticas</h1>
        <p className="mt-1 text-sm text-brand-muted">Resumen de ventas de la tienda online.</p>
        <StatsFilters period={period} payment={paymentMethod} from={params.from} to={params.to} compare={compare} custom={custom} />
      </div>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border bg-white p-4 ${k.accent && stats.pendingOrders > 0 ? "border-amber-300" : "border-black/10"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-brand-ink">{k.value}</p>
            <p
              className={`mt-0.5 text-xs ${
                k.label === "Ingresos (confirmados)" && stats.revenueDelta !== null
                  ? stats.revenueDelta >= 0
                    ? "font-semibold text-green-700"
                    : "font-semibold text-red-600"
                  : "text-brand-muted"
              }`}
            >
              {k.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Secundarias: descuentos, envío, cancelados */}
      <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-black/10 bg-white p-4 text-sm">
        <span className="text-brand-muted">
          Descuentos otorgados: <span className="font-semibold text-brand-ink">{money(stats.discounts)}</span>
        </span>
        <span className="text-brand-muted">
          Envío cobrado: <span className="font-semibold text-brand-ink">{money(stats.shipping)}</span>
        </span>
        <span className="text-brand-muted">
          Pedidos cancelados: <span className="font-semibold text-brand-ink">{stats.cancelledOrders}</span>
        </span>
      </div>

      {/* Ventas en el tiempo */}
      <div className="mt-4 rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Ingresos — {periodLabel}</p>
        {stats.series.length === 0 || stats.revenue === 0 ? (
          <p className="mt-8 text-center text-sm text-brand-muted">Sin ventas confirmadas en este período.</p>
        ) : (
          <div className="mt-4 flex h-48 gap-1">
            {stats.series.map((m, i) => (
              <div key={`${m.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-full w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-brand-pink/80 transition-all hover:bg-brand-pink"
                    style={{ height: `${Math.max(m.revenue > 0 ? 2 : 0, (m.revenue / maxSeries) * 100)}%` }}
                    title={`${m.label}: ${money(m.revenue)} · ${m.orders} pedidos`}
                  />
                </div>
                <span className="text-[10px] text-brand-muted">{i % labelStep === 0 ? m.label : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top productos */}
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Productos más vendidos</p>
          {stats.topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas en este período.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {stats.topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-brand-ink">{p.name}</span>
                    <span className="shrink-0 font-semibold text-brand-ink">
                      {p.quantity} u. <span className="font-normal text-brand-muted">· {money(p.revenue)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-brand-soft">
                    <div
                      className="h-1.5 rounded-full bg-brand-pink"
                      style={{ width: `${(p.quantity / maxProduct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desgloses */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por medio de pago</p>
            {stats.byPayment.length === 0 ? (
              <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {stats.byPayment.map((p) => (
                  <div key={p.method} className="flex items-center justify-between text-sm">
                    <span className="text-brand-ink">{paymentMethodLabel(p.method)}</span>
                    <span className="text-brand-muted">
                      {p.count} · <span className="font-semibold text-brand-ink">{money(p.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por envío</p>
            {stats.byShipping.length === 0 ? (
              <p className="mt-4 text-sm text-brand-muted">Sin ventas confirmadas.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {stats.byShipping.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <span className="text-brand-ink">{s.name}</span>
                    <span className="text-brand-muted">
                      {s.count} · <span className="font-semibold text-brand-ink">{money(s.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-5">
            <p className="text-sm font-semibold text-brand-ink">Por estado</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.byStatus.map((s) => (
                <span
                  key={s.status}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[s.status] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {orderStatusLabel(s.status)}: {s.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Embudo y conversión ---------- */}
      <h2 className="mb-2 mt-8 text-lg font-bold text-brand-ink">Embudo y conversión</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Visitas (sesiones)", value: String(insights.funnel.sessions), hint: vs(insights.funnel.sessions, prevInsights?.funnel.sessions) ?? "sesiones distintas" },
          { label: "Carritos iniciados", value: String(insights.funnel.cartsStarted), hint: vs(insights.funnel.cartsStarted, prevInsights?.funnel.cartsStarted) ?? `${pct(insights.funnel.cartRate)} de las visitas` },
          { label: "Pedidos pagados", value: String(insights.funnel.paidOrders), hint: vs(insights.funnel.paidOrders, prevInsights?.funnel.paidOrders) ?? "confirmados o entregados" },
          { label: "Tasa de conversión", value: pct(insights.funnel.orderRate), hint: compare && prevInsights ? `antes: ${pct(prevInsights.funnel.orderRate)}` : "pedidos pagados / visitas" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-brand-ink">{k.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{k.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-brand-muted">
        Dónde se pierden las ventas: de cada 100 visitas, {insights.funnel.cartRate === null ? "—" : Math.round(insights.funnel.cartRate * 100)} arman un carrito y{" "}
        {insights.funnel.orderRate === null ? "—" : (insights.funnel.orderRate * 100).toFixed(1)} terminan comprando.
      </p>

      {/* ---------- Clientes ---------- */}
      <h2 className="mb-2 mt-8 text-lg font-bold text-brand-ink">Clientes</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Clientes nuevos", value: String(insights.customers.newCustomers), hint: vs(insights.customers.newCustomers, prevInsights?.customers.newCustomers) ?? "cuentas creadas en el período" },
          { label: "Compradores", value: String(insights.customers.buyers), hint: `${insights.customers.firstTimeBuyers} compraron por primera vez` },
          { label: "Clientes recurrentes", value: String(insights.customers.returningBuyers), hint: `${pct(insights.customers.repeatRate)} de los compradores ya habían comprado antes` },
          { label: "Frecuencia de compra", value: insights.customers.avgDaysBetweenPurchases === null ? "—" : `cada ${Math.round(insights.customers.avgDaysBetweenPurchases)} días`, hint: `promedio entre compras (${insights.customers.repeatCustomersAllTime} clientes con 2+ compras)` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-black/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{k.label}</p>
            <p className="mt-1.5 text-2xl font-bold text-brand-ink">{k.value}</p>
            <p className="mt-0.5 text-xs text-brand-muted">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* ---------- Interés: búsquedas y productos más vistos ---------- */}
      <h2 className="mb-2 mt-8 text-lg font-bold text-brand-ink">Qué miran y qué buscan</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Productos más vistos</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {insights.viewedProducts.map((p) => (
              <div key={p.slug} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-brand-ink">{p.name}</span>
                <span className="shrink-0 font-semibold text-brand-ink">{p.views}</span>
              </div>
            ))}
            {insights.viewedProducts.length === 0 && <p className="text-brand-muted">Todavía no hay visitas a fichas de producto en este período.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Búsquedas más frecuentes</p>
          <p className="text-xs text-brand-muted">{insights.searches.total} búsquedas · {insights.searches.distinct} distintas</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {insights.searches.top.map((t) => (
              <div key={t.term} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-brand-ink">“{t.term}”</span>
                <span className="shrink-0 text-brand-muted"><b className="text-brand-ink">{t.count}</b> · ~{Math.round(t.avgResults)} res.</span>
              </div>
            ))}
            {insights.searches.top.length === 0 && <p className="text-brand-muted">Sin búsquedas en este período.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Búsquedas sin resultados</p>
          <p className="text-xs text-brand-muted">{insights.searches.withoutResults} búsquedas no encontraron nada — son productos que te piden y no tenés (o no encuentran).</p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {insights.searches.noResults.map((t) => (
              <div key={t.term} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-brand-ink">“{t.term}”</span>
                <span className="shrink-0 font-semibold text-amber-700">{t.withoutResults}×</span>
              </div>
            ))}
            {insights.searches.noResults.length === 0 && <p className="text-brand-muted">Todas las búsquedas tuvieron resultados.</p>}
          </div>
        </div>
      </div>

      {/* ---------- Cupones y promociones ---------- */}
      <h2 className="mb-2 mt-8 text-lg font-bold text-brand-ink">Cupones y promociones</h2>
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm text-brand-muted">
          {insights.coupons.ordersWithCoupon} de {insights.paidOrders} pedidos pagados usaron un cupón ({pct(insights.coupons.couponShare)}) ·
          descuento total otorgado: <span className="font-semibold text-brand-ink">{money(insights.coupons.discountGiven)}</span>
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
                <th className="py-2 font-semibold">Cupón</th>
                <th className="py-2 font-semibold">Usos</th>
                <th className="py-2 font-semibold">Ventas generadas</th>
                <th className="py-2 font-semibold">Descuento dado</th>
                <th className="py-2 font-semibold">Ticket promedio</th>
              </tr>
            </thead>
            <tbody>
              {insights.coupons.perCoupon.map((c) => (
                <tr key={c.code} className="border-b border-black/5 last:border-0">
                  <td className="py-2 font-medium text-brand-ink">{c.code}</td>
                  <td className="py-2">{c.uses}</td>
                  <td className="py-2">{money(c.revenue)}</td>
                  <td className="py-2">{money(c.discount)}</td>
                  <td className="py-2">{money(c.avgTicket)}</td>
                </tr>
              ))}
              {insights.coupons.perCoupon.length === 0 && <tr><td colSpan={5} className="py-3 text-brand-muted">No se usaron cupones en este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
