// Las fechas "de calendario" que carga el admin (vigencia de cupones, filtros por día) se interpretan
// siempre en la hora de la tienda (Argentina, UTC-3 fijo, sin horario de verano) y no en la del servidor,
// así no se corren un día según dónde esté alojada la app.
const OFFSET_HOURS = -3;
const OFFSET_MS = OFFSET_HOURS * 3600_000;

// "2026-10-31" -> instante de inicio o fin de ese día en hora de la tienda
export function dayToInstant(day: string | null | undefined, end = false): Date | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const base = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(base)) return undefined;
  return new Date(base - OFFSET_MS + (end ? 24 * 3600_000 - 1 : 0));
}

// instante -> "YYYY-MM-DD" del día en hora de la tienda (para <input type="date">)
export function instantToDay(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
