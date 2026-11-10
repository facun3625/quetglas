import nodemailer from "nodemailer";
import { getStoreSettingsRow } from "@/lib/settings";
import { addUsage } from "@/lib/usage";

import { storeNameOf } from "@/lib/storeName";
export type MailSendResult = { ok: boolean; error?: string };

// Sender reusable: resuelve el proveedor configurado (SMTP o Resend) una sola
// vez y devuelve una función `send`. Sirve tanto para envíos sueltos (mail de
// confirmación) como para loops (mailing masivo), sin re-resolver por mensaje.
export type MailSender = {
  from: string;
  send: (to: string, subject: string, html: string) => Promise<MailSendResult>;
};

export type MailSenderConfig = {
  mailFromEmail: string | null;
  mailFromName: string | null;
  franchiseName: string | null;
  mailProvider: string; // "smtp" | "resend"
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  resendApiKey: string | null;
};

// Separado de getMailSender() para poder armar un sender "de prueba" con
// datos que todavía no se guardaron (ver testMailSending en
// admin/configuracion/actions.ts) — mismo patrón que el botón de Telegram.
// TLS directo (secure) solo corresponde al puerto 465; en el 587 (y 25/2525) la conexión arranca sin cifrar y se sube a TLS
// sola (STARTTLS). Marcar "TLS" con el 587 es el error más común y da "wrong version number": se corrige según el puerto.
export function smtpSecureFor(port: number | null | undefined, toggle: boolean): boolean {
  if (port === 465) return true;
  if (port === 587 || port === 25 || port === 2525) return false;
  return toggle;
}

// Traduce los errores técnicos de SMTP a algo que se entienda en el panel
export function friendlySmtpError(message: string): string {
  if (/wrong version number|ssl3_get_record/i.test(message)) return "El servidor no habla TLS directo en ese puerto. Usá el puerto 587 (sin tildar TLS) o el 465 (con TLS).";
  if (/EAUTH|Invalid login|authentication failed|535/i.test(message)) return "Usuario o contraseña incorrectos. Si es Gmail, usá una “contraseña de aplicación”.";
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|timeout|EHOSTUNREACH/i.test(message)) return "No se pudo conectar con el servidor SMTP. Revisá el host y el puerto (algunos proveedores bloquean el 25/465/587 desde servidores).";
  return message;
}

export function buildMailSender(settings: MailSenderConfig): MailSender | null {
  if (!settings.mailFromEmail) return null;

  const fromName = settings.mailFromName || storeNameOf(settings);
  const from = `"${fromName}" <${settings.mailFromEmail}>`;

  if (settings.mailProvider === "resend") {
    const apiKey = settings.resendApiKey?.trim();
    if (!apiKey) return null;
    return {
      from,
      send: async (to, subject, html) => {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to, subject, html }),
          });
          if (res.ok) return { ok: true };
          const detail = (await res.text().catch(() => "")).slice(0, 300);
          return { ok: false, error: `Resend ${res.status}: ${detail}` };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
        }
      },
    };
  }

  // SMTP (default)
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) return null;
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: smtpSecureFor(settings.smtpPort ?? 587, settings.smtpSecure),
    auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    // Por default nodemailer espera hasta 2 minutos antes de tirar error si
    // el puerto está bloqueado (típico en VPS) — con esto falla en 10s y
    // avisa, en vez de dejar el botón "Enviando..." colgado sin feedback.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  return {
    from,
    send: async (to, subject, html) => {
      try {
        await transporter.sendMail({ from, to, subject, html });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? friendlySmtpError(err.message) : "Error SMTP" };
      }
    },
  };
}

// null = todavía no se puede enviar (falta completar la config del proveedor
// elegido en /admin/configuracion). Quien llama decide qué hacer.
export async function getMailSender(): Promise<MailSender | null> {
  const settings = await getStoreSettingsRow();
  const sender = buildMailSender(settings);
  if (!sender) return null;
  // Cada mail enviado resta del cupo mensual (Configuración → Consumo, ver lib/usage.ts). Un fallo al contar nunca
  // rompe el envío. Los mails de compra y de contraseña salen aunque el cupo esté agotado; quien manda marketing
  // consulta marketingMailsLeft() antes.
  return {
    ...sender,
    send: async (to, subject, html) => {
      const result = await sender.send(to, subject, html);
      if (result.ok) await addUsage("mail", 1).catch((err) => console.error("usage: no se pudo contar el mail", err));
      return result;
    },
  };
}
