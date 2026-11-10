// Mes de consumo en hora de Argentina (sin horario de verano: UTC-3 todo el año). Módulo aparte y sin dependencias para
// poder usarlo desde lib/settings.ts y lib/usage.ts sin importarse en círculo.
const AR_OFFSET_MS = 3 * 3600_000;

export function monthKey(now = new Date()): string {
  const d = new Date(now.getTime() - AR_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Primer instante del mes siguiente (medianoche de Argentina)
export function nextResetDate(now = new Date()): Date {
  const d = new Date(now.getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) + AR_OFFSET_MS);
}

// Primer instante del mes en curso (medianoche de Argentina)
export function startOfMonth(now = new Date()): Date {
  const d = new Date(now.getTime() - AR_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + AR_OFFSET_MS);
}
