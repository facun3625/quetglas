"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getStoreSettingsRow } from "@/lib/settings";
import { sendTelegram } from "@/lib/telegram";
import { normalizeTime } from "@/lib/ai/availability";
import { auth } from "@/lib/auth";
import { cleanGaId, cleanGtmId, cleanPixelId, cleanVerificationCode } from "@/lib/seoTags";

import { storeNameOf } from "@/lib/storeName";
export async function updateMaintenanceMode(formData: FormData) {
  await requireAdmin();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", maintenanceMode: formData.get("maintenanceMode") === "on" },
    update: { maintenanceMode: formData.get("maintenanceMode") === "on" },
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/inicio");
}

export async function updateHideOutOfStock(formData: FormData) {
  await requireAdmin();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", hideOutOfStock: formData.get("hideOutOfStock") === "on" },
    update: { hideOutOfStock: formData.get("hideOutOfStock") === "on" },
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/tienda");
  revalidatePath("/");
}

export async function updateCategoryDrilldown(formData: FormData) {
  await requireAdmin();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", categoryDrilldownEnabled: formData.get("categoryDrilldownEnabled") === "on" },
    update: { categoryDrilldownEnabled: formData.get("categoryDrilldownEnabled") === "on" },
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/tienda");
  revalidatePath("/");
}

function optionalText(formData: FormData, name: string, maxLength: number): string | null {
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

// Configuración comercial que maneja el dueño: contenido de la vendedora,
// on/off y horario de WhatsApp. Solo proveedor, modelo y API key permanecen
// en /integraciones porque son datos técnicos y secretos.
export async function updateAiAssistantSettings(formData: FormData) {
  await requireAdmin();

  const humanDays = [...new Set(
    formData
      .getAll("aiHumanDays")
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  )].sort((a, b) => a - b);

  const data = {
    aiAssistantEnabled: formData.get("aiAssistantEnabled") === "on",
    aiAssistantName: optionalText(formData, "aiAssistantName", 60),
    aiWelcomeMessage: optionalText(formData, "aiWelcomeMessage", 500),
    aiInstructions: optionalText(formData, "aiInstructions", 6000),
    aiHumanDays: humanDays,
    aiHumanStartTime: normalizeTime(formData.get("aiHumanStartTime"), "09:00"),
    aiHumanEndTime: normalizeTime(formData.get("aiHumanEndTime"), "18:00"),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

const POPUP_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "popup");
const POPUP_ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_POPUP_IMAGE_BYTES = 4 * 1024 * 1024;

// Insertada desde el botón de imagen del RichTextEditor del pop-up — mismo
// patrón que uploadMailImage, carpeta/ruta propia (public/uploads/popup +
// /api/uploads/popup/[filename]) para no mezclarla con las del mailing.
export async function uploadPopupImage(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen." };
  if (!POPUP_ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Formato no soportado (usá PNG, JPG, WEBP, GIF o AVIF)." };
  if (file.size > MAX_POPUP_IMAGE_BYTES) return { ok: false, error: "La imagen pesa más de 4 MB." };

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(POPUP_UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(POPUP_UPLOAD_DIR, filename), bytes);

  return { ok: true, url: `/api/uploads/popup/${filename}` };
}

const POPUP_SCOPES = new Set(["home", "tienda", "all"]);
const POPUP_FREQUENCIES = new Set(["once", "always"]);

// Pop-up promocional del sitio público — ver components/SitePopupModal.tsx.
export async function updatePopupSettings(formData: FormData) {
  await requireAdmin();

  const scope = formData.get("popupScope");
  const frequency = formData.get("popupFrequency");

  const data = {
    popupEnabled: formData.get("popupEnabled") === "on",
    popupTitle: optionalText(formData, "popupTitle", 100),
    popupBodyHtml: (formData.get("popupBodyHtml") as string)?.trim() || null,
    popupScope: (typeof scope === "string" && POPUP_SCOPES.has(scope) ? scope : "all") as "home" | "tienda" | "all",
    popupFrequency: (typeof frequency === "string" && POPUP_FREQUENCIES.has(frequency) ? frequency : "once") as
      | "once"
      | "always",
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

// Acepta "cortopassi-tienda", "@cortopassi-tienda" o el link completo
// (instagram.com/cortopassi-tienda/) y siempre guarda solo el usuario — así
// no importa qué formato pegue el admin, el link del sitio nunca se rompe.
function normalizeInstagramHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const afterDomain = trimmed.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  return afterDomain.replace(/^@/, "").replace(/\/.*$/, "").trim() || null;
}

export async function updateSiteSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    instagramHandle: normalizeInstagramHandle((formData.get("instagramHandle") as string) ?? ""),
    whatsappPhone: (formData.get("whatsappPhone") as string) || null,
    address: (formData.get("address") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    marqueeText: (formData.get("marqueeText") as string) || null,
    footerText: (formData.get("footerText") as string)?.trim().slice(0, 300) || null,
    homeFeaturedEnabled: formData.get("homeFeaturedEnabled") === "on",
    homeFeaturedTitle: (formData.get("homeFeaturedTitle") as string)?.trim().slice(0, 100) || null,
    homeOffersEnabled: formData.get("homeOffersEnabled") === "on",
    homeOffersTitle: (formData.get("homeOffersTitle") as string)?.trim().slice(0, 100) || null,
    featuredCategoryIds: formData.getAll("featuredCategoryIds").map(String),
    shopPriorityCategoryIds: [...new Set(formData.getAll("shopPriorityCategoryIds").map(String).filter(Boolean))],
    currency: formData.get("currency") === "USD" ? ("USD" as const) : ("ARS" as const),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
  revalidatePath("/tienda");
}

// Cuánto queda abierto el carrito después de agregar un producto (0 = no se cierra solo)
export async function updateCartAutoCloseSettings(formData: FormData) {
  await requireAdmin();
  const seconds = Math.min(10, Math.max(0, Math.floor(Number(formData.get("cartAutoCloseSeconds")) || 0)));
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", cartAutoCloseSeconds: seconds }, update: { cartAutoCloseSeconds: seconds } });
  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracion");
}

// Franja de 3 beneficios del home (ver BenefitsStrip) — cada campo vacío
// vuelve a null, que en getSiteSettings() cae al valor calculado por defecto
// en vez de mostrar un texto vacío.
export async function updateBenefitsSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    benefit1Icon: (formData.get("benefit1Icon") as string) || null,
    benefit1Title: optionalText(formData, "benefit1Title", 80),
    benefit1Subtitle: optionalText(formData, "benefit1Subtitle", 120),
    benefit2Icon: (formData.get("benefit2Icon") as string) || null,
    benefit2Title: optionalText(formData, "benefit2Title", 80),
    benefit2Subtitle: optionalText(formData, "benefit2Subtitle", 120),
    benefit3Icon: (formData.get("benefit3Icon") as string) || null,
    benefit3Title: optionalText(formData, "benefit3Title", 80),
    benefit3Subtitle: optionalText(formData, "benefit3Subtitle", 120),
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
  revalidatePath("/");
}

// El proveedor de envío (SMTP/Resend), sus credenciales y el remitente son
// configuración técnica y se cargan en /integraciones junto con la IA —
// ver updateMailProviderSettings ahí. Acá solo queda la identidad de la
// franquicia (nombre/sucursal), que sí es algo que cualquiera que administre
// la tienda puede querer tocar.
export async function updateMailSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    franchiseName: (formData.get("franchiseName") as string) || null,
    franchiseLocation: (formData.get("franchiseLocation") as string) || null,
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

export async function updateTelegramSettings(formData: FormData) {
  await requireAdmin();

  const token = formData.get("telegramBotToken") as string;

  const data: Record<string, unknown> = {
    telegramChatId: (formData.get("telegramChatId") as string)?.trim() || null,
  };
  // El token es secreto: si lo dejaron en blanco porque ya estaba cargado, no
  // lo pisamos (mismo patrón que la pass del SMTP).
  if (token) data.telegramBotToken = token.trim();

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

// Textos editables del mail "Recibimos tu pedido" (ver lib/orderEmails.ts).
// Vacío = se usa el texto por defecto (no forzamos a nadie a escribir nada).
export async function updateOrderEmailSettings(formData: FormData) {
  await requireAdmin();

  const data = {
    orderEmailIntro: (formData.get("orderEmailIntro") as string)?.trim() || null,
    orderEmailNoteTransfer: (formData.get("orderEmailNoteTransfer") as string)?.trim() || null,
    orderEmailNoteCash: (formData.get("orderEmailNoteCash") as string)?.trim() || null,
    orderEmailNoteMercadopago: (formData.get("orderEmailNoteMercadopago") as string)?.trim() || null,
    orderEmailNotePayway: (formData.get("orderEmailNotePayway") as string)?.trim() || null,
    orderEmailNoteNoPayment: (formData.get("orderEmailNoteNoPayment") as string)?.trim() || null,
    orderEmailClosing: (formData.get("orderEmailClosing") as string)?.trim() || null,
    statusEmailConfirmedEnabled: formData.get("statusEmailConfirmedEnabled") === "on",
    statusEmailConfirmedText: (formData.get("statusEmailConfirmedText") as string)?.trim() || null,
    statusEmailDeliveredEnabled: formData.get("statusEmailDeliveredEnabled") === "on",
    statusEmailDeliveredText: (formData.get("statusEmailDeliveredText") as string)?.trim() || null,
    statusEmailCancelledEnabled: formData.get("statusEmailCancelledEnabled") === "on",
    statusEmailCancelledText: (formData.get("statusEmailCancelledText") as string)?.trim() || null,
  };

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });

  revalidatePath("/admin/configuracion");
}

export type TelegramTestState = { ok: boolean; error?: string };

// Botón "Probar" de la card de Telegram. Recibe el token/chat que el cliente
// leyó de los campos (o vacíos si el token quedó enmascarado por estar ya
// guardado, en cuyo caso caemos al guardado). No guarda nada: solo manda un
// mensaje de prueba y devuelve el resultado para mostrarlo inline.
export async function testTelegram(token: string, chatId: string): Promise<TelegramTestState> {
  await requireAdmin();

  const saved = await getStoreSettingsRow();
  const useToken = token.trim() || saved.telegramBotToken || "";
  const useChatId = chatId.trim() || saved.telegramChatId || "";

  if (!useToken || !useChatId) {
    return { ok: false, error: "Faltan el token o el ID del chat." };
  }

  const result = await sendTelegram(
    useToken,
    useChatId,
    `✅ <b>Prueba de ${storeNameOf(saved)}</b>\nSi ves este mensaje, los avisos de ventas están funcionando.`
  );
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

// Mensajes del checkout (aviso previo y mensajes de "pedido registrado"). Vacío = texto por defecto.
export async function updateCheckoutTexts(formData: FormData) {
  await requireAdmin();
  const text = (name: string) => (formData.get(name) as string | null)?.trim().slice(0, 600) || null;
  const data = {
    checkoutNotice: text("checkoutNotice"),
    successTitle: text("successTitle"),
    successMessage: text("successMessage"),
    successMessageTransfer: text("successMessageTransfer"),
    successMessageCash: text("successMessageCash"),
    successMessageMercadopago: text("successMessageMercadopago"),
    successMessagePayway: text("successMessagePayway"),
    successMessageNoPayment: text("successMessageNoPayment"),
  };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  revalidatePath("/admin/configuracion");
  revalidatePath("/carrito/gracias");
}

// Logos del encabezado y del pie, e ícono del navegador (favicon). Vacío = el original de la instalación.
export async function updateBrandSettings(formData: FormData) {
  await requireAdmin();
  const clean = (name: string) => {
    const v = String(formData.get(name) ?? "").trim().slice(0, 500);
    // Solo imágenes que subió el propio panel (ruta local o URL https del almacenamiento)
    return /^(https:\/\/|\/api\/uploads\/)/.test(v) ? v : null;
  };
  const data = { logoHeaderUrl: clean("logoHeaderUrl"), logoFooterUrl: clean("logoFooterUrl"), faviconUrl: clean("faviconUrl") };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

// SEO del sitio y etiquetas de seguimiento. Cada ID se valida por formato; lo que no cumple se guarda vacío.
// El código propio (etiquetas meta/link/script) solo lo puede cargar el superadmin: si lo edita otro, se conserva el que había.
export async function updateSeoSettings(formData: FormData) {
  await requireAdmin();
  const text = (name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
  const image = String(formData.get("seoImageUrl") ?? "").trim().slice(0, 500);
  const data: Prisma.StoreSettingsUncheckedUpdateInput = {
    seoTitle: text("seoTitle", 70),
    seoDescription: text("seoDescription", 200),
    seoImageUrl: /^(https:\/\/|\/api\/uploads\/)/.test(image) ? image : null,
    seoIndexable: formData.get("seoIndexable") === "on",
    gaMeasurementId: cleanGaId(String(formData.get("gaMeasurementId") ?? "")),
    gtmId: cleanGtmId(String(formData.get("gtmId") ?? "")),
    metaPixelId: cleanPixelId(String(formData.get("metaPixelId") ?? "")),
    googleSiteVerification: cleanVerificationCode(String(formData.get("googleSiteVerification") ?? "")),
    facebookDomainVerification: cleanVerificationCode(String(formData.get("facebookDomainVerification") ?? "")),
  };
  if ((await auth())?.user?.role === "superadmin" && formData.has("customHeadCode")) {
    data.customHeadCode = text("customHeadCode", 10_000);
  }
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...(data as Prisma.StoreSettingsUncheckedCreateInput) }, update: data });
  await logAdminAction("settings.seo");
  revalidatePath("/admin/configuracion");
  revalidatePath("/", "layout");
}

// ---------- Almacenamiento de imágenes y videos (Cloudflare R2) ----------

export async function updateR2Settings(form: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  const { validateR2Fields } = await import("@/lib/r2Test");
  const { invalidateR2Cache } = await import("@/lib/storage");
  const text = (name: string, max = 300) => String(form[name] ?? "").trim().slice(0, max);
  const saved = await prisma.storeSettings.findUnique({ where: { id: "global" } });

  // "Desactivar": vuelve al almacenamiento por variables de entorno o al disco local
  if (form.r2Clear === "on") {
    await prisma.storeSettings.upsert({
      where: { id: "global" },
      create: { id: "global" },
      update: { r2AccountId: null, r2AccessKeyId: null, r2SecretAccessKey: null, r2Bucket: null, r2PublicUrl: null },
    });
    invalidateR2Cache();
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Configuración de R2 borrada. Se usan las variables de entorno o, si no hay, el disco del servidor." };
  }

  const data = {
    r2AccountId: text("r2AccountId", 64) || null,
    r2Bucket: text("r2Bucket", 80) || null,
    r2PublicUrl: text("r2PublicUrl", 200).replace(/\/$/, "") || null,
    // Las claves en blanco no se tocan (quedan las guardadas)
    r2AccessKeyId: text("r2AccessKeyId") || saved?.r2AccessKeyId || null,
    r2SecretAccessKey: text("r2SecretAccessKey") || saved?.r2SecretAccessKey || null,
  };
  const problem = validateR2Fields({
    accountId: data.r2AccountId ?? "",
    accessKeyId: data.r2AccessKeyId ?? "",
    secretAccessKey: data.r2SecretAccessKey ?? "",
    bucket: data.r2Bucket ?? "",
    publicUrl: data.r2PublicUrl ?? "",
  });
  if (problem) return { ok: false, message: problem };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  invalidateR2Cache();
  revalidatePath("/admin/configuracion");
  return { ok: true, message: "Guardado. Desde ahora las imágenes y videos nuevos se suben a R2." };
}

// Botón "Probar conexión": usa lo que hay tipeado en el formulario y, para las claves en blanco, lo ya guardado
export async function testR2Settings(form: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdmin();
  const { testR2Connection } = await import("@/lib/r2Test");
  const saved = await prisma.storeSettings.findUnique({ where: { id: "global" } });
  return testR2Connection({
    accountId: form.r2AccountId?.trim() || saved?.r2AccountId || "",
    accessKeyId: form.r2AccessKeyId?.trim() || saved?.r2AccessKeyId || "",
    secretAccessKey: form.r2SecretAccessKey?.trim() || saved?.r2SecretAccessKey || "",
    bucket: form.r2Bucket?.trim() || saved?.r2Bucket || "",
    publicUrl: (form.r2PublicUrl?.trim() || saved?.r2PublicUrl || "").replace(/\/$/, ""),
  });
}

// Franja de beneficios del inicio: lista de 1 a 6 ítems (ícono de la librería, título y subtítulo)
export async function saveHomeBenefits(items: { icon: string; title: string; subtitle: string }[]): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const { sanitizeBenefits } = await import("@/lib/benefitIcons");
  const clean = sanitizeBenefits(items);
  // Sin ítems = se vuelve a la franja de siempre (los 3 con textos automáticos)
  const homeBenefits = clean.length > 0 ? clean : null;
  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", homeBenefits: homeBenefits ?? undefined },
    update: { homeBenefits: homeBenefits ?? Prisma.DbNull },
  });
  revalidatePath("/admin/configuracion");
  revalidatePath("/");
  return { ok: true, message: clean.length > 0 ? "Franja guardada." : "Se restableció la franja original." };
}

// Cupos mensuales de mails y de tokens de la IA (Configuración → Consumo). Solo el superadministrador los define: son
// los límites del servicio contratado. Vacío = sin límite.
export async function updateUsageQuotas(formData: FormData) {
  await requireSuperAdmin();
  const parse = (raw: FormDataEntryValue | null) => {
    if (typeof raw !== "string" || !raw.trim()) return null;
    const n = Math.floor(Number(raw.replace(/[.\s]/g, "")));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 2_000_000_000) : null;
  };
  const data = { mailMonthlyQuota: parse(formData.get("mailMonthlyQuota")), aiMonthlyTokenQuota: parse(formData.get("aiMonthlyTokenQuota")) };
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  await logAdminAction("usage.quotas", { detail: `mails: ${data.mailMonthlyQuota ?? "sin límite"} · tokens IA: ${data.aiMonthlyTokenQuota ?? "sin límite"}` });
  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/mailing");
  revalidatePath("/admin/inicio");
  revalidatePath("/", "layout");
}
