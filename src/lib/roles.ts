// Roles de la plataforma
//  - customer:    cliente de la tienda
//  - admin:       administrador de la tienda (panel, sin la configuración técnica: correo e imágenes)
//  - superadmin:  dueño técnico de la instalación: ve todo y no aparece en la lista de usuarios del administrador
//  - couponStaff: cuenta genérica de sucursal, sin panel — solo entra a /cupon-rapido (ver proxy.ts)
export type AppRole = "customer" | "admin" | "superadmin" | "couponStaff";

export const isStaff = (role: string | null | undefined): boolean => role === "admin" || role === "superadmin";
export const isSuperAdmin = (role: string | null | undefined): boolean => role === "superadmin";
export const isCouponStaff = (role: string | null | undefined): boolean => role === "couponStaff";
