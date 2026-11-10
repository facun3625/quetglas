"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";

// Marca una conversación como atendida (ya se contactó al cliente o no hace falta) o la vuelve a dejar pendiente
export async function setConversationHandled(id: string, handled: boolean): Promise<void> {
  await requireAdmin();
  await prisma.aiConversation.update({ where: { id }, data: { handledAt: handled ? new Date() : null } });
  revalidatePath("/admin/conversaciones");
  revalidatePath(`/admin/conversaciones/${id}`);
  revalidatePath("/admin", "layout");
}

export async function deleteConversation(id: string): Promise<void> {
  await requireAdmin();
  const row = await prisma.aiConversation.findUnique({ where: { id }, select: { name: true, phone: true } });
  if (!row) return;
  await prisma.aiConversation.delete({ where: { id } });
  await logAdminAction("ai.conversation_delete", { targetType: "ai_conversation", targetId: id, detail: row.name ?? "Sin nombre" });
  revalidatePath("/admin/conversaciones");
  revalidatePath("/admin", "layout");
}
