"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireCouponAccess } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { dayToInstant } from "@/lib/storeTime";
import type { DiscountType, PaymentMethod } from "@/generated/prisma/enums";

// El admin puede cargar el ID o el SKU del producto.
async function resolveProductId(value: FormDataEntryValue | null): Promise<string | null> {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const product = await prisma.product.findFirst({ where: { OR: [{ id: text }, { sku: text }] }, select: { id: true } });
  return product?.id ?? null;
}

async function readCouponData(formData: FormData) {
  const categoryId = formData.get("categoryId");
  const productId = formData.get("productId");
  const paymentMethod = formData.get("paymentMethod");
  const minPurchaseAmount = formData.get("minPurchaseAmount");
  const expiresAt = formData.get("expiresAt");
  const startsAt = formData.get("startsAt");
  const maxUses = formData.get("maxUses");

  return {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    enabled: formData.get("enabled") === "on",
    discountType: (["percentage", "fixed", "free_shipping"].includes(String(formData.get("discountType"))) ? formData.get("discountType") : "percentage") as DiscountType,
    // El cupón de envío gratis no tiene valor: bonifica el envío
    discountValue: formData.get("discountType") === "free_shipping" ? 0 : Math.max(0, Number(formData.get("discountValue")) || 0),
    categoryId: categoryId ? String(categoryId) : null,
    productId: await resolveProductId(productId),
    paymentMethod: paymentMethod ? (paymentMethod as PaymentMethod) : null,
    minPurchaseAmount: minPurchaseAmount ? Number(minPurchaseAmount) : null,
    startsAt: dayToInstant(String(startsAt ?? "")) ?? null,
    expiresAt: dayToInstant(String(expiresAt ?? ""), true) ?? null,
    oneUsePerCustomer: formData.get("oneUsePerCustomer") === "on",
    maxUses: maxUses ? Number(maxUses) : null,
  };
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
  const data = await readCouponData(formData);
  if (!data.code || (data.discountType !== "free_shipping" && data.discountValue <= 0)) return;

  await prisma.coupon.create({ data });
  revalidatePath("/admin/cupones");
}

export async function updateCoupon(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const data = await readCouponData(formData);
  if (!id || !data.code || (data.discountType !== "free_shipping" && data.discountValue <= 0)) return;

  await prisma.coupon.update({ where: { id }, data });
  revalidatePath("/admin/cupones");
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  await prisma.coupon.delete({ where: { id } });
  revalidatePath("/admin/cupones");
}

// Sin caracteres ambiguos (0/O, 1/I/L) — se va a leer en voz alta o escrito
// a mano en el local, no tipeado desde un mail.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateQuickCouponCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `TIENDA-${code}`;
}

export type QuickCouponResult =
  | { ok: true; code: string; discountValue: number; expiresAt: string | null }
  | { ok: false; error: string };

// "Cupón rápido": para cuando alguien compra en el local físico y se lo
// quiere invitar a probar la tienda online — un solo uso, sin condiciones
// de categoría/producto/medio de pago, con vencimiento corto para generar
// urgencia. Se manda por WhatsApp desde el mismo panel (QuickCouponGenerator).
export async function generateQuickCoupon(formData: FormData): Promise<QuickCouponResult> {
  await requireCouponAccess();

  const rawPct = Number(formData.get("discountValue"));
  if (!Number.isFinite(rawPct) || rawPct <= 0) {
    return { ok: false, error: "Cargá un descuento válido." };
  }
  const discountValue = Math.min(100, Math.round(rawPct));

  const rawDays = formData.get("expiresInDays");
  const days = rawDays ? Number(rawDays) : null;
  const expiresAt = days && days > 0 ? new Date(Date.now() + days * 86_400_000) : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateQuickCouponCode();
    try {
      await prisma.coupon.create({
        data: { code, discountType: "percentage", discountValue, maxUses: 1, expiresAt },
      });
      revalidatePath("/admin/cupones");
      return { ok: true, code, discountValue, expiresAt: expiresAt?.toISOString() ?? null };
    } catch (err) {
      // P2002 = choque de unique constraint en `code` (altamente
      // improbable con 6 caracteres al azar, pero el campo es único) —
      // reintenta con un código nuevo. Cualquier otro error, lo dejamos
      // volar.
      const code2002 = (err as { code?: string } | null)?.code === "P2002";
      if (!code2002) throw err;
    }
  }
  return { ok: false, error: "No se pudo generar un código único — probá de nuevo." };
}
