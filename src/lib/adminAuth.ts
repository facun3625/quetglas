import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStaff, isCouponStaff } from "@/lib/roles";

// Check current privileges at the mutation boundary, never just the JWT role.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!isStaff(user?.role)) throw new Error("No autorizado");
  return session;
}

// Para /cupon-rapido y su única acción (generateQuickCoupon): la cuenta genérica
// de sucursal (couponStaff) y también un admin/superadmin de verdad.
export async function requireCouponAccess() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!isStaff(user?.role) && !isCouponStaff(user?.role)) throw new Error("No autorizado");
  return session;
}

// Para lo técnico (correo, almacenamiento de imágenes y videos): solo el superadministrador.
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "superadmin") throw new Error("No autorizado");
  return session;
}
