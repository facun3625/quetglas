"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminLog";
import { paymentMethodLabel } from "@/lib/orderLabels";
import type { PaymentMethod } from "@/generated/prisma/enums";

// Activar/desactivar un medio de pago se guarda solo, al instante (el toggle
// del admin lo llama en onChange). Se maneja aparte del resto del form para no
// pisar el descuento ni las credenciales al togglear.
export async function setPaymentMethodEnabled(method: PaymentMethod, enabled: boolean) {
  await requireAdmin();
  await prisma.paymentMethodConfig.update({ where: { method }, data: { enabled } });
  await logAdminAction(enabled ? "payment.enable" : "payment.disable", {
    targetType: "payment",
    targetId: method,
    detail: paymentMethodLabel(method),
  });
  revalidatePath("/admin/pagos");
}

export async function savePaymentMethodConfig(formData: FormData) {
  await requireAdmin();

  const method = formData.get("method") as PaymentMethod;
  const discountPct = Math.max(0, Number(formData.get("discountPct")) || 0);

  // `enabled` NO se toca acá: lo maneja setPaymentMethodEnabled (toggle
  // instantáneo). Así guardar el descuento/credenciales no lo pisa.
  const data: {
    discountPct: number;
    allowedShippingCodes?: string[];
    mpAccessToken?: string;
    mpPublicKey?: string;
    mpWebhookSecret?: string;
    bankCbu?: string;
    bankAlias?: string;
    bankHolderName?: string;
    paywayPublicKey?: string;
    paywayPrivateKey?: string;
    paywaySandbox?: boolean;
    noPaymentWhatsapp?: boolean;
    noPaymentEmail?: boolean;
    noPaymentInstructions?: string | null;
  } = { discountPct };

  if (method === "mercadopago") {
    // Los campos de credenciales se muestran vacíos (enmascarados) aunque ya
    // haya un valor guardado, para no exponerlo en el HTML. Si el admin no
    // escribe nada nuevo, no lo pisamos.
    const accessToken = formData.get("mpAccessToken") as string;
    const publicKey = formData.get("mpPublicKey") as string;
    if (accessToken) data.mpAccessToken = accessToken;
    if (publicKey) data.mpPublicKey = publicKey;
    const webhookSecret = formData.get("mpWebhookSecret") as string;
    if (webhookSecret) data.mpWebhookSecret = webhookSecret.trim();
  }

  if (method === "payway") {
    // Mismo patrón que Mercado Pago: si dejaron el campo vacío porque ya
    // estaba cargado, no lo pisamos.
    const publicKey = formData.get("paywayPublicKey") as string;
    const privateKey = formData.get("paywayPrivateKey") as string;
    if (publicKey) data.paywayPublicKey = publicKey;
    if (privateKey) data.paywayPrivateKey = privateKey;
    data.paywaySandbox = formData.get("paywaySandbox") === "on";
  }

  if (method === "sin_pago") {
    data.noPaymentWhatsapp = formData.get("noPaymentWhatsapp") === "on";
    data.noPaymentEmail = formData.get("noPaymentEmail") === "on";
    data.noPaymentInstructions = (formData.get("noPaymentInstructions") as string)?.trim().slice(0, 600) || null;
  }

  if (method === "transferencia") {
    // CBU/alias/titular no son secretos (se le muestran al cliente), así que
    // acá sí se pisan directo con lo que haya en el formulario.
    data.bankCbu = (formData.get("bankCbu") as string) || undefined;
    data.bankAlias = (formData.get("bankAlias") as string) || undefined;
    data.bankHolderName = (formData.get("bankHolderName") as string) || undefined;
  }

  // Modalidades de la tienda permitidas (OCA, a acordar); solo se aceptan códigos conocidos
  data.allowedShippingCodes = formData.getAll("shippingCodes").map(String).filter((c) => ["oca_domicilio", "oca_sucursal", "acordar"].includes(c));

  const config = await prisma.paymentMethodConfig.update({ where: { method }, data });

  // Sin filas = sin restricción (acepta cualquier envío habilitado).
  const shippingMethodIds = formData.getAll("shippingMethodIds").map(String);
  await prisma.paymentMethodShipping.deleteMany({ where: { paymentMethodConfigId: config.id } });
  if (shippingMethodIds.length > 0) {
    await prisma.paymentMethodShipping.createMany({
      data: shippingMethodIds.map((shippingMethodId) => ({
        paymentMethodConfigId: config.id,
        shippingMethodId,
      })),
    });
  }

  await logAdminAction("payment.update", {
    targetType: "payment",
    targetId: method,
    detail: `${paymentMethodLabel(method)} — ${discountPct}% desc.`,
  });

  revalidatePath("/admin/pagos");
}

// Excepción de descuento para una categoría puntual dentro de un medio de
// pago (ej. "efectivo: 20% en Bijouterie") — se guarda aparte del form
// principal para no tener que resubmitir todo el resto de la configuración
// cada vez que se agrega/edita una excepción.
export async function upsertPaymentMethodCategoryDiscount(paymentMethodConfigId: string, formData: FormData) {
  await requireAdmin();

  const categoryId = String(formData.get("newCategoryId") ?? "");
  const discountPct = Math.max(0, Math.min(100, Number(formData.get("newCategoryDiscountPct")) || 0));
  if (!categoryId) return;

  await prisma.paymentMethodCategoryDiscount.upsert({
    where: { paymentMethodConfigId_categoryId: { paymentMethodConfigId, categoryId } },
    create: { paymentMethodConfigId, categoryId, discountPct },
    update: { discountPct },
  });

  await logAdminAction("payment.category_discount.update", {
    targetType: "payment",
    targetId: paymentMethodConfigId,
    detail: `Categoría ${categoryId} — ${discountPct}% desc.`,
  });

  revalidatePath("/admin/pagos");
}

export async function deletePaymentMethodCategoryDiscount(id: string) {
  await requireAdmin();
  await prisma.paymentMethodCategoryDiscount.delete({ where: { id } });
  revalidatePath("/admin/pagos");
}
