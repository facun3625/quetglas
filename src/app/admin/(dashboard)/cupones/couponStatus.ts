// Clasificación de cupones para el panel: de dónde vienen (rápido del local, canje de puntos o normal) y en qué estado
// están. Sin Prisma ni hooks, así se usa tanto desde el server como desde el client component del listado.
export type CouponKind = "quick" | "points" | "welcome" | "regular";
export type CouponStatus = "active" | "used" | "expired" | "disabled";

export function couponKind(code: string): CouponKind {
  if (code.startsWith("TIENDA-")) return "quick";
  if (code.startsWith("CANJE-")) return "points";
  if (code.startsWith("BIENVENIDA-")) return "welcome";
  return "regular";
}

export const KIND_LABEL: Record<CouponKind, string> = { quick: "Rápido", points: "Canje", welcome: "Bienvenida", regular: "Normal" };
export const STATUS_LABEL: Record<CouponStatus, string> = { active: "Activo", used: "Usado", expired: "Vencido", disabled: "Deshabilitado" };

export function couponStatus(c: { enabled: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }, now: number): CouponStatus {
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "used";
  if (c.expiresAt && c.expiresAt.getTime() < now) return "expired";
  if (!c.enabled) return "disabled";
  return "active";
}
