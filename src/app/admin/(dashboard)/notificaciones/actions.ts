"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { sendPushToAll } from "@/lib/webPush";

// Corre después de que sendPushBroadcast ya respondió (fire and forget) —
// mismo patrón que runCampaign en /admin/mailing. sendPushToAll ya se
// encarga de limpiar solas las suscripciones muertas (404/410).
async function runPushCampaign(campaignId: string, title: string, body: string, url: string | null) {
  try {
    const { sent } = await sendPushToAll({ title, body, url: url || undefined });
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: { sentCount: sent, status: "done", finishedAt: new Date() },
    });
  } catch (err) {
    console.error("push: la campaña falló", err);
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", finishedAt: new Date() },
    });
  }
  revalidatePath("/admin/notificaciones");
}

export async function sendPushBroadcast(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim() || null;
  if (!title || !body) return;

  const recipientCount = await prisma.pushSubscription.count();

  const campaign = await prisma.pushCampaign.create({
    data: { title, body, url, recipientCount, status: recipientCount > 0 ? "sending" : "done" },
  });

  if (recipientCount > 0) {
    void runPushCampaign(campaign.id, title, body, url);
  }

  revalidatePath("/admin/notificaciones");
}

export async function deletePushCampaign(id: string) {
  await requireAdmin();
  await prisma.pushCampaign.delete({ where: { id } });
  revalidatePath("/admin/notificaciones");
}
