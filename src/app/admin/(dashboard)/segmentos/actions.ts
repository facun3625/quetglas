"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { SEGMENT_TYPES, type SegmentParams } from "@/lib/segments";
import type { SegmentType } from "@/generated/prisma/enums";

export type SegmentInput = { id?: string; name: string; type: SegmentType; params: SegmentParams; enabled: boolean };

export async function saveSegment(input: SegmentInput): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Poné un nombre al segmento" };
  const meta = SEGMENT_TYPES[input.type];
  if (!meta) return { ok: false, error: "Tipo de segmento inválido" };

  // Solo se guardan los parámetros que corresponden al tipo, validados
  const params: SegmentParams = {};
  for (const f of meta.fields) {
    const raw = input.params[f.key];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < (f.min ?? 0)) return { ok: false, error: `Revisá el valor de “${f.label}”` };
    (params as Record<string, number>)[f.key] = n;
  }
  if (input.type === "from_coupon" && input.params.couponId) {
    const coupon = await prisma.coupon.findUnique({ where: { id: input.params.couponId }, select: { id: true } });
    if (!coupon) return { ok: false, error: "El cupón elegido ya no existe" };
    params.couponId = coupon.id;
  }
  const data = { name, type: input.type, params: params as object, enabled: input.enabled };
  if (input.id) await prisma.customerSegment.update({ where: { id: input.id }, data });
  else await prisma.customerSegment.create({ data: { ...data, sortOrder: await prisma.customerSegment.count() } });
  revalidatePath("/admin/segmentos");
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function deleteSegment(id: string) {
  await requireAdmin();
  await prisma.customerSegment.delete({ where: { id } });
  revalidatePath("/admin/segmentos");
  revalidatePath("/admin/usuarios");
}
