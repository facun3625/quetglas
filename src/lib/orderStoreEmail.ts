import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { formatMoneyWith } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orderNumber";
import { addOrderEvent } from "@/lib/orderFlow";
import { resolveLogos, absoluteUrl } from "@/lib/logo";

import { storeNameOf } from "@/lib/storeName";
// Modalidad "Sin pago online": además de entrar al panel, el pedido le llega por mail a la tienda
// (si el admin dejó activada esa opción en Pagos), con todos los datos para coordinar.
export async function sendOrderToStore(orderId: string): Promise<boolean> {
  const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "sin_pago" }, select: { noPaymentEmail: true } });
  if (!config?.noPaymentEmail) return false;
  const settings = await getStoreSettingsRow();
  const to = settings.contactEmail?.trim() || settings.mailFromEmail?.trim();
  const sender = await getMailSender();
  if (!to || !sender) return false;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, shippingMethod: { select: { name: true } } } });
  if (!order) return false;
  const number = formatOrderNumber(order.number);
  const money = (n: number) => formatMoneyWith(n, order.currency);
  const lines = [
    `Nuevo pedido ${number} SIN PAGO ONLINE — hay que coordinar el pago y la entrega con el cliente.`,
    `Cliente: ${order.customerName}\nEmail: ${order.customerEmail}\nTeléfono: ${order.customerPhone ?? "—"}`,
    `Productos:\n${order.items.map((i) => `${i.quantity}x ${i.name} — ${money(i.price * i.quantity)}`).join("\n")}`,
    `Envío: ${order.shippingName ?? order.shippingMethod?.name ?? "—"}${order.shippingAddress ? ` (${order.shippingAddress})` : ""}\nTotal: ${money(order.total)}`,
    `Ver en el panel: ${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/admin/ventas#order-${order.number}`,
  ];
  const subject = `Pedido ${number} (sin pago online) — ${order.customerName}`;
  const result = await sender.send(
    to,
    subject,
    buildMailHtml({
      logoUrl: absoluteUrl(resolveLogos(settings).header),
      franchiseName: storeNameOf(settings),
      franchiseLocation: settings.franchiseLocation,
      subject,
      title: `Pedido ${number}`,
      body: lines.join("\n\n"),
      footer: { siteUrl: process.env.NEXTAUTH_URL },
    })
  );
  await addOrderEvent(orderId, "email", result.ok ? `Se avisó por mail a la tienda (${to}).` : `No se pudo avisar por mail a la tienda (${result.error}).`, "Sistema");
  return result.ok;
}
