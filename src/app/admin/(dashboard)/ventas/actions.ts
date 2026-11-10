"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { formatMoneyWith } from "@/lib/money";
import { logAdminAction } from "@/lib/adminLog";
import { InsufficientStockError, deductStockForOrder, restoreStockForOrder } from "@/lib/stock";
import { syncDeliveredOrders } from "@/lib/points";
import { addOrderEvent } from "@/lib/orderFlow";
import { sendOrderStatusEmail } from "@/lib/orderStatusEmails";
import { reconcileOrder } from "@/lib/mpReconcile";
import { orderStatusLabel } from "@/lib/orderLabels";
import type { OrderStatus } from "@/generated/prisma/enums";

// Texto legible del pedido para el log ("Juan Pérez — $1200").
async function orderLabel(orderId: string): Promise<string> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerName: true, total: true, currency: true },
  });
  return o ? `${o.customerName} — ${formatMoneyWith(o.total, o.currency)}` : orderId;
}

const STATUS_ACTION: Record<OrderStatus, string> = {
  pending: "order.reopen",
  confirmed: "order.confirm",
  delivered: "order.deliver",
  cancelled: "order.cancel",
};

// Cambia el estado del pedido (desde el select del admin, sin botón aceptar).
// Efectos por estado:
//  - cancelled: repone el stock que el pedido había descontado.
//  - volver a abrir un pedido cancelado: vuelve a descontar el stock (falla si ya no alcanza).
//  - delivered: acredita los puntos del pedido (si el sistema de puntos está activo).
export async function changeOrderStatus(orderId: string, status: OrderStatus) {
  const session = await requireAdmin();
  const actor = session.user?.name ?? session.user?.email ?? "Admin";
  const detail = await orderLabel(orderId);

  try {
    await prisma.$transaction(async (tx) => {
      if (status === "cancelled") await restoreStockForOrder(tx, orderId);
      else await deductStockForOrder(tx, orderId);
      await tx.order.update({ where: { id: orderId }, data: { status } });
    });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      const names = err.shortages.map((s) => s.name).join(", ");
      throw new Error(`No hay stock suficiente para reabrir el pedido: ${names}`);
    }
    throw err;
  }
  await logAdminAction(STATUS_ACTION[status], { targetType: "order", targetId: orderId, detail });
  await addOrderEvent(orderId, "status", `Estado cambiado a "${orderStatusLabel(status)}".`, actor);
  // Aviso al comprador (cada estado se puede apagar o editar en Configuración → Mail de compra)
  try {
    await sendOrderStatusEmail(orderId, status, actor);
  } catch (err) {
    console.error("sendOrderStatusEmail failed", orderId, err);
  }

  if (status === "delivered") {
    try {
      await syncDeliveredOrders();
    } catch (err) {
      console.error("syncDeliveredOrders failed for", orderId, err);
    }
  }

  revalidatePath("/admin/ventas");
}

// Elimina el pedido por completo (los items se borran en cascada). Si el pedido
// todavía tenía stock descontado, se repone.
export async function deleteOrder(orderId: string) {
  await requireAdmin();
  const detail = await orderLabel(orderId);
  await prisma.$transaction(async (tx) => {
    await restoreStockForOrder(tx, orderId);
    await tx.order.delete({ where: { id: orderId } });
  });
  await logAdminAction("order.delete", { targetType: "order", targetId: orderId, detail });
  revalidatePath("/admin/ventas");
}

// Nota interna del pedido (no la ve el cliente)
export async function addOrderNote(orderId: string, text: string) {
  const session = await requireAdmin();
  const note = text.trim();
  if (!note) return;
  await addOrderEvent(orderId, "note", note, session.user?.name ?? session.user?.email ?? "Admin");
  revalidatePath("/admin/ventas");
}

// Concilia un pedido de Mercado Pago con lo que informa MP (busca sus pagos y los aplica)
export async function reconcileMercadoPagoOrder(orderId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "mercadopago" }, select: { mpAccessToken: true } });
  if (!config?.mpAccessToken) return { ok: false, message: "Mercado Pago no tiene el Access Token configurado." };
  try {
    const { found, results } = await reconcileOrder(orderId, config.mpAccessToken);
    revalidatePath("/admin/ventas");
    if (found === 0) return { ok: true, message: "Mercado Pago no tiene pagos para este pedido." };
    const changed = results.filter((r) => r.action !== "noop" && r.action !== "ignored").length;
    return { ok: true, message: changed > 0 ? "Pedido actualizado según Mercado Pago. Revisá el historial." : "El pedido ya estaba al día con Mercado Pago." };
  } catch (err) {
    console.error("reconcileMercadoPagoOrder failed", orderId, err);
    return { ok: false, message: "No se pudo consultar a Mercado Pago. Probá de nuevo." };
  }
}

// Registra el envío del pedido en OCA (orden de retiro) y guarda el número de seguimiento.
// Usa los datos del pedido: dirección estructurada, sucursal elegida y el peso/medidas reales de los productos.
export async function registerOcaShipment(orderId: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdmin();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, message: "Pedido no encontrado." };
  if (!order.shippingCode?.startsWith("oca_")) return { ok: false, message: "Este pedido no tiene un envío de OCA." };
  if (order.trackingNumber) return { ok: false, message: `El pedido ya está registrado en OCA (${order.trackingNumber}).` };
  if (order.status === "cancelled") return { ok: false, message: "El pedido está cancelado." };
  const data = order.shippingData as { street?: string; number?: string; apartment?: string; city?: string; province?: string; zipCode?: string; branchId?: string; isBranch?: boolean } | null;
  if (!data?.zipCode) return { ok: false, message: "El pedido no tiene una dirección de envío completa." };

  const { loadShippingConfig } = await import("@/lib/shippingFlow");
  const { ocaIngresoOr, OcaError } = await import("@/lib/oca/client");
  const cfg = await loadShippingConfig();
  const [firstFromName, ...restFromName] = order.customerName.trim().split(/\s+/);
  try {
    const { nroOR } = await ocaIngresoOr(
      cfg.oca,
      {
        orderNumber: order.number,
        firstName: order.contactFirstName || firstFromName || order.customerName,
        lastName: order.contactLastName || restFromName.join(" ") || firstFromName || order.customerName,
        phone: order.customerPhone ?? "",
        email: order.customerEmail,
        isBranch: order.shippingCode === "oca_sucursal",
        address: data,
        items: order.items.map((i) => ({ quantity: i.quantity, weight: i.weight, width: i.width, height: i.height, length: i.length })),
      },
      { defaults: cfg.defaults }
    );
    await prisma.order.update({ where: { id: orderId }, data: { trackingNumber: nroOR, trackingCarrier: "OCA", ocaRegisteredAt: new Date() } });
    await addOrderEvent(orderId, "system", `Envío registrado en OCA. Nº de seguimiento ${nroOR}.`, session.user?.name ?? session.user?.email ?? "Admin");
    await logAdminAction("order.oca_register", { targetType: "order", targetId: orderId, detail: `${await orderLabel(orderId)} — OCA ${nroOR}` });
    revalidatePath("/admin/ventas");
    return { ok: true, message: `Envío registrado en OCA. Número: ${nroOR}.` };
  } catch (err) {
    if (err instanceof OcaError) return { ok: false, message: err.message };
    console.error("registerOcaShipment failed", orderId, err);
    return { ok: false, message: "No se pudo registrar el envío en OCA. Probá de nuevo." };
  }
}

// Los pedidos que se muestran en pantalla pasan a "vistos": dejan de contar en la campanita y en el número de Ventas.
// Solo marca los que todavía no se habían visto, y nunca toca el estado del pedido.
export async function markOrdersSeen(ids: string[]): Promise<void> {
  await requireAdmin();
  const clean = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0 && id.length < 60))].slice(0, 200);
  if (clean.length === 0) return;
  await prisma.order.updateMany({ where: { id: { in: clean }, adminSeenAt: null }, data: { adminSeenAt: new Date() } });
}
