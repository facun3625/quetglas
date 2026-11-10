import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender, type MailSender } from "@/lib/mailer";
import { marketingMailsLeft } from "@/lib/usage";
import { buildMailHtml } from "@/lib/mailTemplate";
import { formatMoneyWith } from "@/lib/money";
import { absoluteUrl, resolveLogos } from "@/lib/logo";
import { siteUrl } from "@/lib/siteUrl";
import { recoverCartItems } from "@/lib/cartRecovery";
import type { CartItem } from "@/lib/cart";

import { storeNameOf } from "@/lib/storeName";
// Recuperación automática de carritos por mail. La prende y apaga el interruptor de
// Carritos abandonados; la dispara instrumentation.ts cada pocos minutos.
//
// Reglas (para no molestar ni mandar de más):
//  - un mail por carrito, y como mucho uno cada MIN_GAP_DAYS por carrito;
//  - solo carritos quietos hace al menos `cartRecoveryDelayHours` y no más de MAX_AGE_DAYS: al
//    prenderlo no se avisa a carritos viejos de hace semanas;
//  - nunca a quien ya compró después de dejar el carrito, ni a quien se dio de baja;
//  - solo con productos que hoy se pueden comprar (precio, stock y foto se recalculan al enviar).

export const MIN_GAP_DAYS = 3;
export const MAX_AGE_DAYS = 3;
export const DEFAULT_DELAY_HOURS = 4;
const BATCH = 50;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const DEFAULT_SUBJECT = "¿Te olvidaste algo en tu carrito?";
export const DEFAULT_MESSAGE = "Vimos que dejaste productos en tu carrito. Te los guardamos para que puedas terminar tu compra cuando quieras:";

export function clampDelayHours(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(72, Math.max(1, v)) : DEFAULT_DELAY_HOURS;
}

// ---------- Baja ----------
// El link del mail lleva el email y una firma, así nadie puede dar de baja a otra persona.
function optOutSignature(email: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`cart-optout:${email.toLowerCase()}`).digest("base64url");
}

export function optOutUrl(email: string): string {
  return `${siteUrl()}/api/cart-recovery/baja?e=${encodeURIComponent(email.toLowerCase())}&s=${optOutSignature(email)}`;
}

export function verifyOptOut(email: string, signature: string): boolean {
  if (!process.env.AUTH_SECRET || !email || !signature) return false;
  const a = Buffer.from(optOutSignature(email));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------- Armado del mail ----------
type MailSettings = Awaited<ReturnType<typeof getStoreSettingsRow>>;

export function buildRecoveryMail(opts: { settings: MailSettings; name: string | null; email: string; items: CartItem[]; link: string; preview?: boolean }) {
  const { settings, items } = opts;
  const store = storeNameOf(settings);
  const base = siteUrl();
  const subject = settings.cartRecoverySubject?.trim() || DEFAULT_SUBJECT;
  const intro = settings.cartRecoveryMessage?.trim() || DEFAULT_MESSAGE;
  const first = opts.name?.trim().split(/\s+/)[0] ?? "";
  const lines = items.map((i) => `• ${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} — ${formatMoneyWith(i.price * i.quantity, settings.currency)}`);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const html = buildMailHtml({
    logoUrl: absoluteUrl(resolveLogos(settings).header, base),
    franchiseName: store,
    franchiseLocation: settings.franchiseLocation,
    subject,
    title: first ? `¡Hola, ${first}!` : "¡Hola!",
    body: `${intro}\n\n${lines.join("\n")}\n\nTotal: ${formatMoneyWith(total, settings.currency)}`,
    cta: { label: "Completar mi compra", url: opts.link },
    footerNote: { text: "Recibís este mail porque dejaste productos en tu carrito.", linkLabel: "No quiero recibir más recordatorios", linkUrl: optOutUrl(opts.email) },
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: process.env.NEXTAUTH_URL,
    },
  });
  return { subject, html };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecoveryRunResult = { ok: boolean; sent: number; skipped: number; message?: string };

// Un pase: busca carritos elegibles y manda los mails. Lo llama el planificador del server.
export async function runCartRecovery(now = new Date(), deps: { sender?: MailSender | null } = {}): Promise<RecoveryRunResult> {
  const settings = await getStoreSettingsRow();
  if (!settings.cartRecoveryEnabled) return { ok: true, sent: 0, skipped: 0, message: "apagado" };
  const sender = deps.sender === undefined ? await getMailSender() : deps.sender;
  if (!sender) return { ok: false, sent: 0, skipped: 0, message: "El correo no está configurado" };

  // Cupo mensual de mails: al agotarse, la recuperación automática se frena hasta el mes siguiente
  const left = await marketingMailsLeft(now);
  if (left !== null && left <= 0) return { ok: false, sent: 0, skipped: 0, message: "Se agotó el cupo mensual de mails" };

  const cutoff = new Date(now.getTime() - clampDelayHours(settings.cartRecoveryDelayHours) * HOUR);
  const oldest = new Date(now.getTime() - MAX_AGE_DAYS * DAY);
  const gap = new Date(now.getTime() - MIN_GAP_DAYS * DAY);

  const carts = await prisma.abandonedCart.findMany({
    where: {
      lastActive: { gte: oldest, lte: cutoff },
      OR: [{ recoveryEmailSentAt: null }, { recoveryEmailSentAt: { lte: gap } }],
      AND: [{ OR: [{ email: { not: null } }, { userId: { not: null } }] }],
    },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { lastActive: "asc" },
    take: BATCH,
  });

  let sent = 0;
  let skipped = 0;
  for (const cart of carts) {
    // Ya se le avisó por este mismo movimiento del carrito: esperar a que lo vuelva a tocar
    if (cart.recoveryEmailSentAt && cart.recoveryEmailSentAt >= cart.lastActive) continue;
    if (left !== null && sent >= left) return { ok: false, sent, skipped, message: "Se agotó el cupo mensual de mails" };

    const email = (cart.user?.email ?? cart.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { skipped++; continue; }
    if (await prisma.cartRecoveryOptOut.findUnique({ where: { email }, select: { email: true } })) { skipped++; continue; }
    const bought = await prisma.order.findFirst({
      where: { createdAt: { gt: cart.lastActive }, OR: [{ customerEmail: { equals: email, mode: "insensitive" } }, ...(cart.userId ? [{ userId: cart.userId }] : [])] },
      select: { id: true },
    });
    if (bought) { skipped++; continue; }
    const items = await recoverCartItems(cart.id);
    if (items.length === 0) { skipped++; continue; }

    // Se "reserva" el carrito antes de mandar: si dos pasos corren a la vez, solo uno lo consigue.
    // Se repite lastActive para que marcar el envío no cuente como actividad del cliente.
    const claim = await prisma.abandonedCart.updateMany({
      where: { id: cart.id, lastActive: cart.lastActive, recoveryEmailSentAt: cart.recoveryEmailSentAt },
      data: { recoveryEmailSentAt: now, lastActive: cart.lastActive },
    });
    if (claim.count === 0) continue;

    const { subject, html } = buildRecoveryMail({ settings, name: cart.user?.name ?? cart.name, email, items, link: `${siteUrl()}/carrito?recuperar=${cart.id}&utm_source=email&utm_medium=email&utm_campaign=recuperar-carrito` });
    const result = await sender.send(email, subject, html);
    if (!result.ok) {
      // Se libera para reintentar en el próximo pase y se corta: casi seguro es un problema del correo
      await prisma.abandonedCart.updateMany({ where: { id: cart.id }, data: { recoveryEmailSentAt: cart.recoveryEmailSentAt, lastActive: cart.lastActive } });
      console.error("cart recovery: no se pudo enviar", result.error);
      return { ok: false, sent, skipped, message: result.error ?? "No se pudo enviar" };
    }
    sent++;
  }
  return { ok: true, sent, skipped };
}
