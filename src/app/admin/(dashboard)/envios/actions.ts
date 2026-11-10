"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function createShippingMethod(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.shippingMethod.create({
    data: {
      name,
      description: (formData.get("description") as string) || undefined,
      cost: Math.max(0, Number(formData.get("cost")) || 0),
      requiresAddress: formData.get("requiresAddress") === "on",
      enabled: formData.get("enabled") === "on",
    },
  });

  revalidatePath("/admin/envios");
}

export async function updateShippingMethod(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  await prisma.shippingMethod.update({
    where: { id },
    data: {
      name,
      description: (formData.get("description") as string) || null,
      cost: Math.max(0, Number(formData.get("cost")) || 0),
      requiresAddress: formData.get("requiresAddress") === "on",
      enabled: formData.get("enabled") === "on",
    },
  });

  revalidatePath("/admin/envios");
}

export async function deleteShippingMethod(id: string) {
  await requireAdmin();
  await prisma.shippingMethod.delete({ where: { id } });
  revalidatePath("/admin/envios");
}

// ---------- Configuración general de envíos ----------

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};
const text = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

async function saveSettings(data: Record<string, unknown>) {
  await prisma.storeSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
  revalidatePath("/admin/envios");
}

export async function saveShippingGeneral(formData: FormData) {
  await requireAdmin();
  await saveSettings({
    freeShippingEnabled: formData.get("freeShippingEnabled") === "on",
    freeShippingThreshold: Math.max(0, num(formData.get("freeShippingThreshold"))),
    acordarEnabled: formData.get("acordarEnabled") === "on",
    zipRestrictionsEnabled: formData.get("zipRestrictionsEnabled") === "on",
    zipDiscountsEnabled: formData.get("zipDiscountsEnabled") === "on",
    shippingDefaultWeightKg: Math.max(0.01, num(formData.get("shippingDefaultWeightKg"), 1)),
    shippingDefaultDimCm: Math.max(1, num(formData.get("shippingDefaultDimCm"), 20)),
  });
}

// ---------- OCA ePak ----------

export async function saveOcaSettings(formData: FormData) {
  await requireAdmin();
  const data: Record<string, unknown> = {
    ocaEnabled: formData.get("ocaEnabled") === "on",
    ocaCuit: text(formData.get("ocaCuit"), 20) || null,
    ocaOperativa: text(formData.get("ocaOperativa"), 20) || null,
    ocaOperativaSucursal: text(formData.get("ocaOperativaSucursal"), 20) || null,
    ocaOriginZipCode: text(formData.get("ocaOriginZipCode"), 10) || null,
    ocaOriginStreet: text(formData.get("ocaOriginStreet"), 120) || null,
    ocaOriginNumber: text(formData.get("ocaOriginNumber"), 20) || null,
    ocaOriginFloor: text(formData.get("ocaOriginFloor"), 40) || null,
    ocaOriginCity: text(formData.get("ocaOriginCity"), 80) || null,
    ocaOriginProvince: text(formData.get("ocaOriginProvince"), 40) || null,
    ocaOriginContact: text(formData.get("ocaOriginContact"), 80) || null,
    ocaOriginEmail: text(formData.get("ocaOriginEmail"), 120) || null,
    ocaFranjaHoraria: ["1", "2", "3"].includes(text(formData.get("ocaFranjaHoraria"), 1)) ? text(formData.get("ocaFranjaHoraria"), 1) : "1",
    ocaUser: text(formData.get("ocaUser"), 120) || null,
    ocaNroCliente: text(formData.get("ocaNroCliente"), 30) || null,
    ocaBranchDiscountPct: Math.min(100, Math.max(0, num(formData.get("ocaBranchDiscountPct"), 30))),
  };
  // La contraseña nunca vuelve al navegador: en blanco = no se toca. "Quitar" la borra.
  const password = String(formData.get("ocaPassword") ?? "");
  if (formData.get("ocaPasswordClear") === "on") data.ocaPassword = null;
  else if (password.trim()) data.ocaPassword = password.trim();
  await saveSettings(data);
}

// Prueba de cotización desde el panel (para verificar CUIT, operativa y código postal de origen)
export async function testOcaQuote(zipCode: string, weightKg: number): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const { loadShippingConfig } = await import("@/lib/shippingFlow");
  const { ocaQuote, ocaBranches, OcaError } = await import("@/lib/oca/client");
  const cfg = await loadShippingConfig();
  const zip = zipCode.trim();
  if (!/^\d{4}$/.test(zip)) return { ok: false, message: "Ingresá un código postal de destino de 4 dígitos." };
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : cfg.defaults.weightKg;
  const dim = cfg.defaults.dimCm;
  try {
    const [q, branches] = await Promise.all([
      ocaQuote(cfg.oca, { destinationZip: zip, weightKg: w, volumeM3: (dim * dim * dim) / 1_000_000 }),
      ocaBranches(zip),
    ]);
    return {
      ok: true,
      message: `OCA respondió: $${q.price.toFixed(2)} (con IVA, $${q.priceBeforeTax.toFixed(2)} + $${q.iva.toFixed(2)}), entrega en ${q.deliveryDays} días. Sucursales para ${zip}: ${branches.length}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof OcaError ? err.message : "No se pudo conectar con OCA." };
  }
}

// ---------- Zonas: restricciones y descuentos por código postal ----------

function parseZips(raw: FormDataEntryValue | null): string[] {
  return Array.from(new Set(String(raw ?? "").split(/[\s,;]+/).map((z) => z.trim().toUpperCase()).filter((z) => /^[A-Z0-9-]{3,10}$/.test(z)))).slice(0, 500);
}

export async function createZipRestriction(formData: FormData) {
  await requireAdmin();
  const type = formData.get("type") === "block_sale" ? "block_sale" : "block_shipping";
  const zips = parseZips(formData.get("zipCodes"));
  const data = { message: text(formData.get("message"), 400) || null, address: text(formData.get("address"), 200) || null, phone: text(formData.get("phone"), 40) || null };
  for (const zipCode of zips) {
    await prisma.zipCodeRestriction.upsert({ where: { zipCode_type: { zipCode, type } }, create: { zipCode, type, ...data }, update: data });
  }
  revalidatePath("/admin/envios");
}

export async function deleteZipRestriction(id: string) {
  await requireAdmin();
  await prisma.zipCodeRestriction.deleteMany({ where: { id } });
  revalidatePath("/admin/envios");
}

export async function createZipDiscount(formData: FormData) {
  await requireAdmin();
  const discountType = formData.get("discountType") === "fixed" ? "fixed" : "percentage";
  const value = Math.max(0, num(formData.get("discountValue")));
  if (value <= 0 || (discountType === "percentage" && value > 100)) return;
  const data = { discountType, discountValue: value, label: text(formData.get("label"), 80) || null, enabled: true } as const;
  for (const zipCode of parseZips(formData.get("zipCodes"))) {
    await prisma.zipCodeDiscount.upsert({ where: { zipCode }, create: { zipCode, ...data }, update: data });
  }
  revalidatePath("/admin/envios");
}

export async function toggleZipDiscount(id: string, enabled: boolean) {
  await requireAdmin();
  await prisma.zipCodeDiscount.updateMany({ where: { id }, data: { enabled } });
  revalidatePath("/admin/envios");
}

export async function deleteZipDiscount(id: string) {
  await requireAdmin();
  await prisma.zipCodeDiscount.deleteMany({ where: { id } });
  revalidatePath("/admin/envios");
}
