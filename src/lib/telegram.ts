import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith, type CurrencyCode } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orderNumber";

// Aviso al equipo por Telegram cuando entra una venta web. Se dispara "fire
// and forget" desde la ruta de pedidos (ver api/orders/route.ts): nunca tira
// error hacia arriba ni demora la respuesta al cliente. Si no hay bot/chat
// configurado en Configuración, simplemente no hace nada.

const PAYMENT_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
  mercadopago: "Mercado Pago",
  payway: "Tarjeta (Payway)",
  sin_pago: "Sin pago online",
};

// Telegram con parse_mode HTML necesita escapar estos tres caracteres.
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Envío de bajo nivel a la API de Telegram. Devuelve ok/error en vez de
// tirar, para poder reusarlo tanto en el aviso automático (que traga los
// errores) como en el botón "Probar" del admin (que los muestra).
export async function sendTelegram(
  token: string,
  chatId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) return { ok: true };
    const detail = await res.text().catch(() => "");
    // Telegram devuelve { description } con el motivo (token inválido, chat no
    // encontrado, etc.) — lo pasamos tal cual para que sea útil en el admin.
    let description = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(detail) as { description?: string };
      if (parsed.description) description = parsed.description;
    } catch {
      /* dejamos el HTTP status */
    }
    return { ok: false, error: description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  }
}

export type NewOrderNotification = {
  orderId: string;
  orderNumber?: number;
  customerName: string;
  customerPhone?: string | null;
  paymentMethod: string;
  total: number;
  items: { name: string; quantity: number }[];
  shippingName?: string | null;
  shippingAddress?: string | null;
};

function buildMessage(order: NewOrderNotification, currency: CurrencyCode): string {
  const money = (value: number) => formatMoneyWith(value, currency);
  const lines: string[] = [];
  lines.push(`🛍️ <b>Nueva venta web</b> ${escapeHtml(order.orderNumber ? formatOrderNumber(order.orderNumber) : "#" + order.orderId.slice(0, 8))}`);
  lines.push("");
  lines.push(`👤 ${escapeHtml(order.customerName)}`);
  if (order.customerPhone) lines.push(`📱 ${escapeHtml(order.customerPhone)}`);
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod;
  lines.push(`💳 ${escapeHtml(paymentLabel)} — ${money(order.total)}`);
  lines.push("");
  for (const item of order.items) {
    lines.push(`• ${item.quantity}x ${escapeHtml(item.name)}`);
  }
  if (order.shippingName) {
    lines.push("");
    const address = order.shippingAddress ? `: ${escapeHtml(order.shippingAddress)}` : "";
    lines.push(`📍 ${escapeHtml(order.shippingName)}${address}`);
  }

  // Link directo al pedido en el admin (si sabemos la URL del sitio). El
  // ancla #order-xxxx coincide con el id de la fila en /admin/ventas.
  const base = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (base) {
    lines.push("");
    lines.push(`<a href="${base}/admin/ventas#order-${order.orderNumber ?? escapeHtml(order.orderId.slice(0, 8))}">Ver en el panel →</a>`);
  }

  return lines.join("\n");
}

export async function notifyNewOrder(order: NewOrderNotification): Promise<void> {
  const settings = await getStoreSettingsRow();
  const token = settings.telegramBotToken?.trim();
  const chatId = settings.telegramChatId?.trim();
  if (!token || !chatId) return; // sin configurar → no se avisa, y punto

  const result = await sendTelegram(token, chatId, buildMessage(order, settings.currency));
  if (!result.ok) console.error("notifyNewOrder: Telegram falló —", result.error);
}
