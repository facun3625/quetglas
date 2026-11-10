import { prisma } from "@/lib/prisma";
import { getUsageStatus } from "@/lib/usage";
import { startOfMonth } from "@/lib/monthKey";

export type MailQuotaStatus = {
  quota: number | null; // null = sin cupo cargado todavía
  used: number; // todos los mails enviados este mes (campañas, avisos de compra, recuperación de carritos, contraseñas)
  remaining: number | null;
  resetsOn: Date; // día 1 del próximo mes
  campaignsThisMonth: { id: string; subject: string; sentCount: number; createdAt: Date }[];
};

// El consumo sale del contador mensual (lib/usage.ts), que suma cada mail que sale; acá se agrega el detalle de las
// campañas del mes para la pestaña Disponibilidad de Mailing.
export async function getMailQuotaStatus(): Promise<MailQuotaStatus> {
  const usage = await getUsageStatus();
  const campaignsThisMonth = await prisma.mailCampaign.findMany({
    where: { createdAt: { gte: startOfMonth() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, subject: true, sentCount: true, createdAt: true },
  });
  return { quota: usage.mail.quota, used: usage.mail.used, remaining: usage.mail.remaining, resetsOn: usage.resetsOn, campaignsThisMonth };
}
