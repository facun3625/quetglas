import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { formatOrderNumber } from "@/lib/orderNumber";
import { prisma } from "@/lib/prisma";
import { addOrderEvent } from "@/lib/orderFlow";
import type { OrderStatus } from "@/generated/prisma/enums";
import { resolveLogos, absoluteUrl } from "@/lib/logo";

import { storeNameOf } from "@/lib/storeName";
// Mail automático al comprador cuando el admin cambia el estado de su pedido. Cada estado se puede
// apagar y su texto se edita en /admin/configuracion → "Mail de compra". {nombre} y {pedido} se reemplazan.
export const STATUS_EMAIL_DEFAULTS: Partial<Record<OrderStatus, { subject: string; text: string }>> = {
  confirmed: {
    subject: "Confirmamos tu pedido {pedido}",
    text: "Hola {nombre}, confirmamos el pago de tu pedido {pedido} y ya lo estamos preparando. Te avisamos cuando esté en camino.",
  },
  delivered: {
    subject: "Tu pedido {pedido} fue entregado",
    text: "Hola {nombre}, tu pedido {pedido} figura como entregado. ¡Gracias por tu compra! Si hay algún problema, respondé este mail.",
  },
  cancelled: {
    subject: "Tu pedido {pedido} fue cancelado",
    text: "Hola {nombre}, tu pedido {pedido} fue cancelado. Si no lo esperabas o tenés dudas, respondé este mail y lo revisamos.",
  },
};

export type StatusEmailOutcome = "sent" | "disabled" | "no-mail-provider" | "failed" | "not-applicable";

export async function sendOrderStatusEmail(orderId: string, status: OrderStatus, actor: string | null): Promise<StatusEmailOutcome> {
  const defaults = STATUS_EMAIL_DEFAULTS[status];
  if (!defaults) return "not-applicable";
  const settings = await getStoreSettingsRow();
  const config = {
    confirmed: { enabled: settings.statusEmailConfirmedEnabled, text: settings.statusEmailConfirmedText },
    delivered: { enabled: settings.statusEmailDeliveredEnabled, text: settings.statusEmailDeliveredText },
    cancelled: { enabled: settings.statusEmailCancelledEnabled, text: settings.statusEmailCancelledText },
  }[status as "confirmed" | "delivered" | "cancelled"];
  if (!config.enabled) return "disabled";

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { number: true, customerName: true, customerEmail: true } });
  if (!order) return "failed";
  const sender = await getMailSender();
  if (!sender) {
    await addOrderEvent(orderId, "email", "No se envió el aviso de estado: falta configurar el proveedor de correo.", actor);
    return "no-mail-provider";
  }

  const firstName = order.customerName.split(" ")[0] || order.customerName;
  const fill = (text: string) => text.replaceAll("{nombre}", firstName).replaceAll("{pedido}", formatOrderNumber(order.number));
  const subject = fill(defaults.subject);
  const html = buildMailHtml({
    logoUrl: absoluteUrl(resolveLogos(settings).header),
    franchiseName: storeNameOf(settings),
    franchiseLocation: settings.franchiseLocation,
    subject,
    title: `Pedido ${formatOrderNumber(order.number)}`,
    body: fill(config.text?.trim() || defaults.text),
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: process.env.NEXTAUTH_URL,
    },
  });
  const result = await sender.send(order.customerEmail, subject, html);
  await addOrderEvent(orderId, "email", result.ok ? `Se envió el aviso "${subject}" a ${order.customerEmail}.` : `No se pudo enviar el aviso de estado (${result.error}).`, actor);
  return result.ok ? "sent" : "failed";
}
