import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { monthKey, nextResetDate } from "@/lib/monthKey";

// Consumo mensual con cupo: mails enviados y tokens de la IA. Cada envío o respuesta suma al contador del mes en curso
// (hora de Argentina) y el cupo, si está cargado en Configuración → Consumo, se va "restando". El 1 de cada mes arranca
// un contador nuevo solo: no hay nada que reiniciar.
//
// Qué pasa cuando se agota (ver los puntos de uso):
//  - mails: se frenan los de marketing y automáticos (campañas, recuperación de carritos); los de compra, cambio de
//    estado y recuperar contraseña salen siempre, porque un cliente no puede quedarse sin su confirmación;
//  - IA: la vendedora se reemplaza por el acceso directo a WhatsApp hasta el mes siguiente.

export type UsageKind = "mail" | "ai_tokens" | "ai_requests";

export { monthKey, nextResetDate, startOfMonth } from "@/lib/monthKey";

export async function addUsage(kind: UsageKind, amount: number, now = new Date()): Promise<void> {
  const n = Math.round(amount);
  if (!Number.isFinite(n) || n <= 0) return;
  const month = monthKey(now);
  await prisma.monthlyUsage.upsert({
    where: { month_kind: { month, kind } },
    create: { month, kind, amount: n },
    update: { amount: { increment: n } },
  });
}

export type UsageLine = {
  used: number;
  quota: number | null; // null = sin límite
  remaining: number | null;
  pct: number; // 0..100 (tope 100 aunque se pase)
  exhausted: boolean;
  warning: boolean; // 80% o más
};

export type UsageStatus = { month: string; resetsOn: Date; mail: UsageLine; ai: UsageLine; aiRequests: number };

export function usageLine(used: number, quota: number | null): UsageLine {
  const hasQuota = quota !== null && quota > 0;
  const q = hasQuota ? (quota as number) : null;
  return {
    used,
    quota: q,
    remaining: q !== null ? Math.max(0, q - used) : null,
    pct: q !== null ? Math.min(100, Math.round((used / q) * 100)) : 0,
    exhausted: q !== null && used >= q,
    warning: q !== null && used >= q * 0.8,
  };
}

export async function getUsageStatus(now = new Date()): Promise<UsageStatus> {
  const month = monthKey(now);
  const [settings, rows] = await Promise.all([getStoreSettingsRow(), prisma.monthlyUsage.findMany({ where: { month } })]);
  const used = (kind: UsageKind) => rows.find((r) => r.kind === kind)?.amount ?? 0;
  return {
    month,
    resetsOn: nextResetDate(now),
    mail: usageLine(used("mail"), settings.mailMonthlyQuota),
    ai: usageLine(used("ai_tokens"), settings.aiMonthlyTokenQuota),
    aiRequests: used("ai_requests"),
  };
}

// Cuántos mails de marketing se pueden mandar todavía este mes (null = sin límite)
export async function marketingMailsLeft(now = new Date()): Promise<number | null> {
  return (await getUsageStatus(now)).mail.remaining;
}

export async function isAiQuotaExhausted(now = new Date()): Promise<boolean> {
  return (await getUsageStatus(now)).ai.exhausted;
}
