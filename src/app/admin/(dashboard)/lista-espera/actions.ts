"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function deleteWaitlistEntry(id: string) {
  await requireAdmin();
  await prisma.waitlistEntry.delete({ where: { id } });
  revalidatePath("/admin/lista-espera");
}

// Anota que se abrió un WhatsApp para este aviso de stock.
export async function markWaitlistWhatsApp(id: string) {
  await requireAdmin();
  await prisma.waitlistEntry.updateMany({ where: { id }, data: { whatsappSentAt: new Date(), whatsappCount: { increment: 1 } } });
  revalidatePath("/admin/lista-espera");
}
