import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getCustomerRows } from "@/lib/customers";
import { getUsageStatus } from "@/lib/usage";
import type { OrderStatus } from "@/generated/prisma/enums";

import { storeNameOf } from "@/lib/storeName";
// "Vendido" = pedidos con el pago confirmado o ya entregados
const PAID: OrderStatus[] = ["confirmed", "delivered"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

const CHART_DAYS = 14;

// Todas las estadísticas del home del admin, en un solo lugar. Se pisa
// bastante con lo que ya calculan las páginas de cada sección, pero acá
// interesa la foto agregada, no el detalle — separado a propósito para no
// mezclar responsabilidades.
export async function getDashboardStats() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const chartStart = daysAgo(CHART_DAYS - 1);

  const [
    settings,
    userCount,
    newUsersThisWeek,
    revenueThisMonthAgg,
    revenueLastMonthAgg,
    pendingOrdersCount,
    confirmedOrdersCount,
    cancelledOrdersCount,
    chartOrders,
    recentOrders,
    ordersByPaymentMethod,
    abandonedCartCount,
    abandonedCartValueAgg,
    recentAbandonedCarts,
    waitlistCount,
    recentWaitlist,
    activeCouponsCount,
    subscriberCount,
    pointsIssuedAgg,
    pointsRedeemedAgg,
    mailCampaignsSentCount,
    heroSlideCount,
  ] = await Promise.all([
    getStoreSettingsRow(),
    prisma.user.count({ where: { role: { not: "superadmin" } } }),
    prisma.user.count({ where: { role: { not: "superadmin" }, createdAt: { gte: daysAgo(6) } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      _count: true,
      where: { status: { in: PAID }, createdAt: { gte: startOfThisMonth } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: PAID }, createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } },
    }),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: { in: PAID } } }),
    prisma.order.count({ where: { status: "cancelled" } }),
    prisma.order.findMany({
      where: { status: { in: PAID }, createdAt: { gte: chartStart } },
      select: { total: true, createdAt: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, customerName: true, total: true, status: true, paymentMethod: true, createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["paymentMethod"],
      where: { status: { in: PAID } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.abandonedCart.count(),
    prisma.abandonedCart.aggregate({ _sum: { total: true } }),
    prisma.abandonedCart.findMany({
      orderBy: { lastActive: "desc" },
      take: 5,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.coupon.count({ where: { enabled: true } }),
    prisma.newsletterSubscriber.count(),
    prisma.pointTransaction.aggregate({ _sum: { amount: true }, where: { amount: { gt: 0 } } }),
    prisma.pointTransaction.aggregate({ _sum: { amount: true }, where: { amount: { lt: 0 } } }),
    prisma.mailCampaign.count({ where: { status: "done" } }),
    prisma.heroSlide.count(),
  ]);

  const chartMap = new Map<string, number>();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    chartMap.set(daysAgo(i).toISOString().slice(0, 10), 0);
  }
  for (const o of chartOrders) {
    const key = startOfDay(o.createdAt).toISOString().slice(0, 10);
    if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) ?? 0) + o.total);
  }
  const chart = [...chartMap.entries()].map(([date, total]) => ({ date, total }));

  const [totalProducts, outOfStockProducts, lowStockRows] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { type: "simple", manageStock: true, stock: { lte: 0 } } }),
    prisma.product.findMany({
      where: { type: "simple", manageStock: true, stock: { gt: 0 } },
      select: { id: true, name: true, stock: true },
      orderBy: { stock: "asc" },
      take: 5,
    }),
  ]);
  const outOfStockCount = outOfStockProducts;
  const lowStockProducts = lowStockRows.map((p) => ({ id: p.id, name: p.name, stock: p.stock }));

  const nowDate = new Date();
  const hoursAgo = (h: number) => new Date(nowDate.getTime() - h * 3600_000);
  const promoWindow = { OR: [{ promoStartsAt: null }, { promoStartsAt: { lte: nowDate } }], AND: [{ OR: [{ promoEndsAt: null }, { promoEndsAt: { gte: nowDate } }] }] };
  const couponActive = { enabled: true, userId: null, OR: [{ startsAt: null }, { startsAt: { lte: nowDate } }], AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: nowDate } }] }] };
  const [
    stalePending,
    mpReview,
    unreadMessages,
    expiringCoupons,
    noImageProducts,
    enabledPaymentMethods,
    enabledShippingMethods,
    activeCoupons,
    promoProducts,
    customerRows,
  ] = await Promise.all([
    prisma.order.count({ where: { status: "pending", createdAt: { lt: hoursAgo(24) } } }),
    prisma.order.count({ where: { status: "pending", paymentMethod: "mercadopago", createdAt: { lt: hoursAgo(1) } } }),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.coupon.count({ where: { enabled: true, userId: null, expiresAt: { gte: nowDate, lte: new Date(nowDate.getTime() + 3 * 86400_000) } } }),
    prisma.product.count({ where: { status: "published", images: { none: {} } } }),
    prisma.paymentMethodConfig.count({ where: { enabled: true } }),
    prisma.shippingMethod.count({ where: { enabled: true } }),
    prisma.coupon.findMany({ where: couponActive, orderBy: { usedCount: "desc" }, take: 4, select: { id: true, code: true, discountType: true, discountValue: true, usedCount: true, maxUses: true, expiresAt: true } }),
    prisma.product.count({ where: { status: "published", promoPrice: { not: null }, ...promoWindow } }),
    getCustomerRows(),
  ]);
  const activeCouponsTotal = await prisma.coupon.count({ where: couponActive });
  const usage = await getUsageStatus();
  const bestCustomers = customerRows
    .filter((c) => c.stats.orders > 0)
    .sort((a, b) => b.stats.spent - a.stats.spent)
    .slice(0, 5)
    .map((c) => ({ id: c.id, name: c.name ?? c.email, orders: c.stats.orders, spent: c.stats.spent }));
  const frequentCustomers = customerRows.filter((c) => c.stats.orders >= 3).length;

  type Alert = { level: "critical" | "warning" | "info"; text: string; href: string };
  const alerts: Alert[] = [];
  if (enabledPaymentMethods === 0) alerts.push({ level: "critical", text: "No hay ningún medio de pago habilitado: nadie puede comprar.", href: "/admin/pagos" });
  if (enabledShippingMethods === 0) alerts.push({ level: "critical", text: "No hay ningún método de envío habilitado: el checkout no puede continuar.", href: "/admin/envios" });
  if (mpReview > 0) alerts.push({ level: "warning", text: `${mpReview} pedido(s) de Mercado Pago llevan más de 1 hora pendientes: conciliá el pago desde Ventas.`, href: "/admin/ventas?status=pending&payment=mercadopago" });
  if (stalePending > 0) alerts.push({ level: "warning", text: `${stalePending} pedido(s) esperan confirmación hace más de 24 horas.`, href: "/admin/ventas?status=pending" });
  if (unreadMessages > 0) alerts.push({ level: "warning", text: `${unreadMessages} mensaje(s) de contacto sin leer.`, href: "/admin/mensajes" });
  if (!(settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.mailFromEmail) && !settings.resendApiKey) alerts.push({ level: "warning", text: "El correo no está configurado: no salen los mails de pedido ni de recuperación de contraseña.", href: "/integraciones" });
  // Cupos mensuales (Configuración → Consumo): aviso al llegar al 80% y otro, más fuerte, al agotarse
  if (usage.mail.exhausted) alerts.push({ level: "critical", text: "Se agotó el cupo mensual de mails: las campañas y la recuperación de carritos están frenadas hasta el mes que viene.", href: "/admin/configuracion" });
  else if (usage.mail.warning) alerts.push({ level: "warning", text: `Usaste el ${usage.mail.pct}% del cupo mensual de mails (quedan ${usage.mail.remaining?.toLocaleString("es-AR")}).`, href: "/admin/configuracion" });
  if (usage.ai.exhausted) alerts.push({ level: "critical", text: "Se agotó el cupo mensual de la vendedora de IA: la tienda ofrece WhatsApp hasta el mes que viene.", href: "/admin/configuracion" });
  else if (usage.ai.warning) alerts.push({ level: "warning", text: `Usaste el ${usage.ai.pct}% del cupo mensual de la vendedora de IA (quedan ${usage.ai.remaining?.toLocaleString("es-AR")} tokens).`, href: "/admin/configuracion" });
  if (noImageProducts > 0) alerts.push({ level: "info", text: `${noImageProducts} producto(s) publicados no se ven en la tienda porque no tienen imagen.`, href: "/admin/productos" });
  if (outOfStockCount > 0) alerts.push({ level: "info", text: `${outOfStockCount} producto(s) sin stock.`, href: "/admin/productos?sort=stock" });
  if (expiringCoupons > 0) alerts.push({ level: "info", text: `${expiringCoupons} cupón(es) vencen en los próximos 3 días.`, href: "/admin/cupones" });

  const revenueThisMonth = revenueThisMonthAgg._sum.total ?? 0;
  const revenueLastMonth = revenueLastMonthAgg._sum.total ?? 0;
  const revenueTrendPct = revenueLastMonth > 0 ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 : null;

  const smtpOk = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.mailFromEmail);

  return {
    currency: settings.currency,
    userLabel: storeNameOf(settings),
    maintenanceMode: settings.maintenanceMode,
    userCount,
    newUsersThisWeek,
    revenueThisMonth,
    ordersThisMonth: revenueThisMonthAgg._count,
    revenueTrendPct,
    pendingOrdersCount,
    confirmedOrdersCount,
    cancelledOrdersCount,
    chart,
    recentOrders,
    ordersByPaymentMethod,
    abandonedCartCount,
    abandonedCartValue: abandonedCartValueAgg._sum.total ?? 0,
    recentAbandonedCarts,
    waitlistCount,
    recentWaitlist,
    activeCouponsCount,
    subscriberCount,
    pointsIssued: pointsIssuedAgg._sum.amount ?? 0,
    pointsRedeemed: Math.abs(pointsRedeemedAgg._sum.amount ?? 0),
    mailCampaignsSentCount,
    heroSlideCount,
    totalProducts,
    outOfStockCount,
    lowStockProducts,
    alerts,
    promotions: { activeCoupons, activeCouponsTotal, promoProducts },
    bestCustomers,
    frequentCustomers,
    health: {
      catalogOk: totalProducts > 0,
      smtpOk,
      pointsEnabled: settings.pointsEnabled,
      heroSlideCount,
    },
  };
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;
