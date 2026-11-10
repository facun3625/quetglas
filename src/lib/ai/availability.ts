import { storeNameOf } from "@/lib/storeName";
const STORE_TIME_ZONE = "America/Argentina/Cordoba";
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_LABELS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

type AvailabilitySettings = {
  franchiseName?: string | null;
  aiHumanHandoffEnabled?: boolean;
  aiHumanDays?: number[];
  aiHumanStartTime?: string;
  aiHumanEndTime?: string;
  whatsappPhone?: string | null;
};

function validTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && validTime(value) ? value : fallback;
}

export function getHumanSellerAvailability(settings: AvailabilitySettings, now = new Date()) {
  const phone = settings.whatsappPhone?.replace(/\D/g, "") ?? "";
  const configuredDays = Array.isArray(settings.aiHumanDays)
    ? settings.aiHumanDays
    : [1, 2, 3, 4, 5, 6];
  const days = [...new Set(configuredDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  const start = normalizeTime(settings.aiHumanStartTime, "09:00");
  const end = normalizeTime(settings.aiHumanEndTime, "18:00");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = DAY_INDEX[parts.find((part) => part.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const current = `${hour}:${minute}`;
  const previousWeekday = (weekday + 6) % 7;
  const scheduledNow = start < end
    ? days.includes(weekday) && current >= start && current < end
    : start > end
      ? (days.includes(weekday) && current >= start) || (days.includes(previousWeekday) && current < end)
      : false;
  const handoffEnabled = settings.aiHumanHandoffEnabled ?? true;
  const available = handoffEnabled && Boolean(phone) && scheduledNow;
  const dayText = days.length === 7
    ? "todos los días"
    : days.length > 0
      ? days.map((day) => DAY_LABELS[day]).join(", ")
      : "sin días configurados";

  return {
    enabled: handoffEnabled && Boolean(phone),
    available,
    scheduleText: `${dayText}, de ${start} a ${end} h`,
    whatsappUrl: available
      ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, vengo del asistente de ${storeNameOf(settings)} y quiero hablar con una persona.`)}`
      : null,
  };
}
