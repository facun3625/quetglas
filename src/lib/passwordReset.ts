import { resolveLogos, absoluteUrl } from "@/lib/logo";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getMailSender } from "@/lib/mailer";
import { getStoreSettingsRow } from "@/lib/settings";
import { buildMailHtml } from "@/lib/mailTemplate";

import { storeNameOf } from "@/lib/storeName";
// Recuperación / creación de contraseña por email. El token se manda por mail
// y en la base solo queda su hash SHA-256: ni un volcado de la base permite
// usarlo. Es de un solo uso y vence.
export const RESET_TTL_MS = 60 * 60 * 1000; // olvidé mi contraseña: 1 hora
export const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // cuentas migradas: 7 días
const MIN_INTERVAL_MS = 60 * 1000; // anti-spam: un pedido por minuto por cuenta
const MIN_PASSWORD = 8;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createResetToken(userId: string, ttlMs = RESET_TTL_MS): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export type ResetMailKind = "reset" | "activation";

export async function sendResetEmail(user: { id: string; email: string; name: string | null }, kind: ResetMailKind): Promise<boolean> {
  const sender = await getMailSender();
  if (!sender) return false;
  const settings = await getStoreSettingsRow();
  const token = await createResetToken(user.id, kind === "activation" ? ACTIVATION_TTL_MS : RESET_TTL_MS);
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const link = `${base}/recuperar?token=${encodeURIComponent(token)}`;
  const name = user.name?.split(" ")[0] || "";
  const store = storeNameOf(settings);
  const subject = kind === "activation" ? `Activá tu cuenta en ${store}` : `Restablecé tu contraseña de ${store}`;
  const intro =
    kind === "activation"
      ? `Pasamos a una tienda nueva y tu cuenta ya está lista. Para entrar, creá tu contraseña desde este enlace (vale 7 días):`
      : `Recibimos un pedido para restablecer tu contraseña. Podés crear una nueva desde este enlace (vale 1 hora):`;
  const html = buildMailHtml({
    logoUrl: absoluteUrl(resolveLogos(settings).header, base),
    franchiseName: store,
    franchiseLocation: settings.franchiseLocation,
    subject,
    title: name ? `¡Hola, ${name}!` : "¡Hola!",
    body: `${intro}\n\n${link}\n\n${kind === "reset" ? "Si no fuiste vos, ignorá este mensaje: tu contraseña no cambia." : "Si ya tenés tu contraseña, ignorá este mensaje."}`,
    footer: {
      address: settings.address,
      whatsappNumber: settings.whatsappPhone,
      instagramHandle: settings.instagramHandle,
      contactEmail: settings.mailFromEmail,
      siteUrl: process.env.NEXTAUTH_URL,
    },
  });
  const result = await sender.send(user.email, subject, html);
  if (!result.ok) console.error("sendResetEmail failed", result.error);
  return result.ok;
}

// "Olvidé mi contraseña": nunca revela si el email existe (misma respuesta siempre).
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Matcheo exacto por si el email se guardó con mayúsculas
  const found = user ?? (await prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } }));
  if (!found) return;
  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: found.id, createdAt: { gt: new Date(Date.now() - MIN_INTERVAL_MS) } },
    select: { id: true },
  });
  if (recent) return;
  await sendResetEmail(found, "reset");
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(token: string, password: string): Promise<ResetResult> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` };
  }
  if (password.length > 200) return { ok: false, error: "La contraseña es demasiado larga" };
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash(String(token)) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "El enlace venció o ya fue usado. Pedí uno nuevo." };
  }
  const passwordHash = await bcrypt.hash(password, 10);
  // Se marca como usado con una condición, así dos envíos simultáneos no lo consumen dos veces.
  const consumed = await prisma.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count === 0) return { ok: false, error: "El enlace venció o ya fue usado. Pedí uno nuevo." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);
  return { ok: true };
}
