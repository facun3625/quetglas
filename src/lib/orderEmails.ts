import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { sendPushToUser } from "@/lib/webPush";
import { formatOrderNumber } from "@/lib/orderNumber";
import { resolveLogos, absoluteUrl } from "@/lib/logo";

import { storeNameOf } from "@/lib/storeName";
// Mail "Recibimos tu pedido" que se le manda al cliente al confirmar la compra.
// Fire and forget desde la ruta de pedidos: nunca tira ni frena la venta.
//
// El intro, la nota por medio de pago y el cierre son EDITABLES desde
// /admin/configuracion → "Mail de compra" (ver StoreSettings.orderEmail*).
// Si el admin no cargó nada, se usan estos textos por defecto. El detalle de
// productos y los totales NO son editables: son datos reales del pedido.

// Exportados para poder mostrarlos como placeholder en /admin/configuracion.
export const DEFAULT_INTRO =
  "¡Gracias por tu compra, {nombre}! Recibimos tu pedido #{pedido} y ya lo estamos preparando.";

export const DEFAULT_NOTES: Record<string, string> = {
  transferencia:
    "Recibimos tu pedido y tu comprobante. Estamos verificando el pago; si surge algún inconveniente nos comunicamos con vos. Si está todo bien, coordinamos la entrega.",
  contra_entrega: "Vas a abonar al momento de recibir el pedido.",
  mercadopago: "Tu pago con Mercado Pago fue registrado.",
  payway: "Tu pago con tarjeta ya fue aprobado.",
  sin_pago: "Recibimos tu pedido. Nos vamos a poner en contacto con vos para coordinar el pago y la entrega.",
};

export const DEFAULT_CLOSING = "Cualquier duda, respondé este mail o escribinos. ¡Gracias por elegirnos!";

// Mapea el medio de pago al campo de StoreSettings correspondiente.
const NOTE_FIELD: Record<
  string,
  "orderEmailNoteTransfer" | "orderEmailNoteCash" | "orderEmailNoteMercadopago" | "orderEmailNotePayway" | "orderEmailNoteNoPayment"
> = {
  transferencia: "orderEmailNoteTransfer",
  contra_entrega: "orderEmailNoteCash",
  mercadopago: "orderEmailNoteMercadopago",
  payway: "orderEmailNotePayway",
  sin_pago: "orderEmailNoteNoPayment",
};

function fillPlaceholders(text: string, vars: { nombre: string; pedido: string }): string {
  return text.replaceAll("{nombre}", vars.nombre).replaceAll("{pedido}", vars.pedido);
}

export type OrderConfirmationEmail = {
  orderId: string;
  orderNumber?: number;
  to: string;
  customerName: string;
  items: { name: string; quantity: number }[];
  subtotal: number;
  discountTotal: number;
  shippingName: string;
  shippingCost: number;
  total: number;
  paymentMethod: string;
  shippingAddress?: string | null;
  // Si compró logueado, además del mail se le manda un push (a todos sus
  // dispositivos suscriptos) — si no tiene ninguno, o compró como
  // invitado, sendPushToUser no hace nada.
  userId?: string | null;
};

export async function sendOrderConfirmation(order: OrderConfirmationEmail): Promise<void> {
  const settings = await getStoreSettingsRow();
  const money = (value: number) => formatMoneyWith(value, settings.currency);
  const shortIdForPush = order.orderNumber ? formatOrderNumber(order.orderNumber).slice(1) : order.orderId.slice(0, 8);
  if (order.userId) {
    sendPushToUser(order.userId, {
      title: "¡Recibimos tu pedido! 🎉",
      body: `Pedido #${shortIdForPush} confirmado — ya lo estamos preparando.`,
      url: "/mi-cuenta/pedidos",
    }).catch((err) => console.error("sendOrderConfirmation: push falló —", err));
  }

  const sender = await getMailSender();
  if (!sender) return; // sin proveedor de mail configurado → no se manda el mail (el push ya salió)

  const shortId = shortIdForPush;
  const firstName = order.customerName.split(" ")[0] || order.customerName;
  const vars = { nombre: firstName, pedido: shortId };

  const intro = fillPlaceholders(settings.orderEmailIntro || DEFAULT_INTRO, vars);
  const noteField = NOTE_FIELD[order.paymentMethod];
  const rawNote = (noteField && settings[noteField]) || DEFAULT_NOTES[order.paymentMethod];
  const note = rawNote ? fillPlaceholders(rawNote, vars) : null;
  const closing = fillPlaceholders(settings.orderEmailClosing || DEFAULT_CLOSING, vars);

  // El cuerpo va como texto (la plantilla parte por líneas/párrafos). Armamos
  // el resumen del pedido línea por línea — esta parte SIEMPRE es la real,
  // no se edita.
  const detail = order.items.map((i) => `${i.quantity}x ${i.name}`).join("\n");
  const totals: string[] = [`Subtotal: ${money(order.subtotal)}`];
  if (order.discountTotal > 0) totals.push(`Descuento: -${money(order.discountTotal)}`);
  totals.push(`Envío (${order.shippingName}): ${order.shippingCost > 0 ? money(order.shippingCost) : "sin cargo"}`);
  totals.push(`Total: ${money(order.total)}`);

  const paragraphs = [intro, `Detalle del pedido:\n${detail}`, totals.join("\n")];
  if (order.shippingAddress) paragraphs.push(`Envío a: ${order.shippingAddress}`);
  if (note) paragraphs.push(note);
  paragraphs.push(closing);

  const html = buildMailHtml({
    logoUrl: absoluteUrl(resolveLogos(settings).header),
    franchiseName: storeNameOf(settings),
    franchiseLocation: settings.franchiseLocation,
    subject: `Recibimos tu pedido #${shortId}`,
    title: `¡Hola, ${firstName}!`,
    body: paragraphs.join("\n\n"),
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: process.env.NEXTAUTH_URL,
    },
  });

  const result = await sender.send(order.to, `Recibimos tu pedido #${shortId}`, html);
  if (!result.ok) console.error("sendOrderConfirmation: no se pudo enviar —", result.error);
}
