"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { syncDeliveredOrders } from "@/lib/points";
import type { DiscountType } from "@/generated/prisma/enums";

export async function updatePointsSettings(formData: FormData) {
  await requireAdmin();

  // El campo del panel pide "puntos cada $1.000 gastados" (más intuitivo que
  // el ratio con el que se guarda y se calcula puntos por pedido) — se
  // convierte acá, dividiendo por 1000.
  const perThousand = Number(formData.get("pointsPerThousand"));
  const ratio = perThousand > 0 ? perThousand / 1000 : 0.01;

  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", pointsEnabled: formData.get("pointsEnabled") === "on", pointsRatio: ratio },
    update: { pointsEnabled: formData.get("pointsEnabled") === "on", pointsRatio: ratio },
  });

  revalidatePath("/admin/puntos");
}

function readRewardData(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    pointsRequired: Math.max(1, Number(formData.get("pointsRequired")) || 0),
    discountType: formData.get("discountType") as DiscountType,
    discountValue: Math.max(0, Number(formData.get("discountValue")) || 0),
    enabled: formData.get("enabled") === "on",
  };
}

export async function createReward(formData: FormData) {
  await requireAdmin();
  const data = readRewardData(formData);
  if (!data.title) return;

  await prisma.pointReward.create({ data });
  revalidatePath("/admin/puntos");
}

export async function updateReward(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const data = readRewardData(formData);
  if (!id || !data.title) return;

  await prisma.pointReward.update({ where: { id }, data });
  revalidatePath("/admin/puntos");
}

export async function deleteReward(id: string) {
  await requireAdmin();
  await prisma.pointReward.delete({ where: { id } });
  revalidatePath("/admin/puntos");
}

// El botón vive en /admin/configuracion (junto al resto de las cosas
// operativas del día a día) aunque la acción en sí siga acá, junto con el
// resto de la lógica de puntos.
export async function syncNow() {
  await requireAdmin();
  const result = await syncDeliveredOrders();
  revalidatePath("/admin/puntos");
  revalidatePath("/admin/configuracion");
  redirect(
    `/admin/configuracion?synced=1&checked=${result.checked}&awarded=${result.awarded}${result.skipped ? "&skipped=1" : ""}`
  );
}
