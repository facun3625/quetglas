"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { buildMailSender } from "@/lib/mailer";
import { DEFAULT_AI_MODELS } from "@/lib/ai/types";
import type { AiProvider } from "@/generated/prisma/enums";

import { storeNameOf } from "@/lib/storeName";
function textField(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

// Configuración técnica/secreta de la vendedora IA (proveedor, modelo y API
// key). El nombre, bienvenida, instrucciones de venta, on/off y horario de
// WhatsApp los maneja el dueño desde /admin/configuracion.
export async function updateAiSecretSettings(formData: FormData) {
  await requireAdmin();

  const saved = await getStoreSettingsRow();
  const providerValue = formData.get("aiProvider");
  const provider: AiProvider | null =
    providerValue === "openai" || providerValue === "gemini" ? providerValue : null;
  const newApiKey = textField(formData, "aiApiKey", 500);

  const data = {
    aiProvider: provider,
    aiModel: provider
      ? textField(formData, "aiModel", 100) || DEFAULT_AI_MODELS[provider]
      : null,
    ...(newApiKey
      ? { aiApiKey: newApiKey }
      : provider !== saved.aiProvider
        ? { aiApiKey: null }
        : {}),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/integraciones");
  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

// Proveedor de envío de mail (SMTP/Resend), sus credenciales y el
// remitente. La identidad de la franquicia (nombre/sucursal) la sigue
// manejando el dueño de la tienda desde /admin/configuracion — ver
// updateMailSettings ahí.
export async function updateMailProviderSettings(formData: FormData) {
  await requireSuperAdmin();

  const port = formData.get("smtpPort");
  // Espacios o saltos de línea de más (típico al copiar y pegar) hacen fallar el login: se sacan al guardar
  const password = String(formData.get("smtpPassword") ?? "").trim();
  const resendKey = formData.get("resendApiKey") as string;
  const provider = formData.get("mailProvider") === "resend" ? "resend" : "smtp";

  const data: Record<string, unknown> = {
    mailProvider: provider,
    smtpHost: String(formData.get("smtpHost") ?? "").trim() || null,
    smtpPort: port ? Number(port) : null,
    smtpSecure: formData.get("smtpSecure") === "on",
    smtpUser: String(formData.get("smtpUser") ?? "").trim() || null,
    mailFromName: (formData.get("mailFromName") as string) || null,
    mailFromEmail: (formData.get("mailFromEmail") as string) || null,
  };
  // Igual que con las credenciales de Mercado Pago: si dejaron el campo de
  // contraseña/API key vacío (porque ya estaba cargado y no lo tocaron), no lo pisamos.
  if (password) data.smtpPassword = password;
  if (resendKey) data.resendApiKey = resendKey.trim();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/integraciones");
  revalidatePath("/admin/configuracion");
}

export type MailTestState = { ok: boolean; error?: string };

// Botón "Probar mail" de la card de mail. Igual que Telegram: prueba con lo
// que hay tipeado en el form (sin guardar nada), y si un campo vino vacío
// porque está enmascarado (contraseña/API key ya guardadas), cae a lo que ya
// hay en la base — así se puede probar sin tener que reescribir credenciales.
export async function testMailSending(to: string, form: Record<string, string>): Promise<MailTestState> {
  await requireSuperAdmin();

  const email = to.trim();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Ingresá un email válido para la prueba." };
  }

  const saved = await getStoreSettingsRow();
  const provider = form.mailProvider === "resend" ? "resend" : "smtp";

  const sender = buildMailSender({
    mailFromEmail: form.mailFromEmail?.trim() || saved.mailFromEmail,
    mailFromName: form.mailFromName?.trim() || saved.mailFromName,
    franchiseName: saved.franchiseName,
    mailProvider: provider,
    smtpHost: form.smtpHost?.trim() || saved.smtpHost,
    smtpPort: Number(form.smtpPort) || saved.smtpPort,
    smtpSecure: form.smtpSecure === "on",
    smtpUser: form.smtpUser?.trim() || saved.smtpUser,
    smtpPassword: form.smtpPassword?.trim() || saved.smtpPassword,
    resendApiKey: form.resendApiKey?.trim() || saved.resendApiKey,
  });

  if (!sender) {
    return {
      ok: false,
      error:
        provider === "resend"
          ? "Faltan datos de Resend (email remitente y/o API key)."
          : "Faltan datos del SMTP (remitente, host, usuario y/o contraseña).",
    };
  }

  const result = await sender.send(
    email,
    `Prueba de ${storeNameOf(saved)}`,
    "<p>✅ Si ves este mail, el envío está funcionando bien.</p>"
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
