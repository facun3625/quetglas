import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Texto legible por código de acción. Si aparece uno sin mapear, se muestra
// el código crudo (mejor que ocultarlo).
const ACTION_LABELS: Record<string, string> = {
  "category.create": "Creó una categoría",
  "category.delete": "Eliminó una categoría",
  "attribute.create": "Creó un atributo",
  "attribute.delete": "Eliminó un atributo",
  "migration.undo": "Deshizo la migración (borró lo migrado)",
  "user.create_admin": "Creó un administrador",
  "user.make_admin": "Hizo administrador a un usuario",
  "user.reset_password": "Restableció la contraseña de un usuario",
  "user.remove_admin": "Quitó el rol de administrador",
  "user.make_coupon_staff": "Dio acceso a cupón rápido (sucursal)",
  "order.confirm": "Confirmó el pago",
  "order.cancel": "Canceló el pedido",
  "order.deliver": "Marcó como entregado",
  "order.reopen": "Reabrió el pedido (pago pendiente)",
  "order.delete": "Eliminó el pedido",
  "payment.enable": "Activó un medio de pago",
  "payment.disable": "Desactivó un medio de pago",
  "payment.update": "Editó un medio de pago",
  "product.create": "Creó un producto",
  "product.update": "Editó un producto",
  "product.delete": "Eliminó un producto",
  "theme.save": "Guardó un tema visual",
  "theme.activate": "Activó un tema visual",
  "theme.deactivate": "Desactivó un tema visual",
  "theme.delete": "Eliminó un tema visual",
  "page.save": "Guardó una página",
  "page.delete": "Eliminó una página",
  "cart_recovery.enable": "Activó la recuperación automática de carritos",
  "cart_recovery.disable": "Suspendió la recuperación automática de carritos",
  "cart_recovery.save": "Cambió los ajustes de recuperación de carritos",
  "settings.seo": "Cambió el SEO y las etiquetas del sitio",
  "usage.quotas": "Cambió los cupos mensuales de mails y de IA",
  "ai.conversation_delete": "Eliminó una conversación de la vendedora IA",
  "backup.create": "Hizo una copia de seguridad",
  "backup.delete": "Eliminó una copia de seguridad",
  "migration.start": "Inició la migración desde WooCommerce",
  "migration.activation_emails": "Envió mails de activación a clientes migrados",
};

export function adminActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

// hideSuperAdmin: el administrador de la tienda no ve lo que hizo el superadministrador
export async function getAdminLogsPage(opts: { limit: number; offset: number; hideSuperAdmin?: boolean }) {
  const supers = opts.hideSuperAdmin ? await prisma.user.findMany({ where: { role: "superadmin" }, select: { email: true } }) : [];
  const where = supers.length > 0 ? { adminEmail: { notIn: supers.map((u) => u.email) } } : {};
  const [logs, total] = await Promise.all([
    prisma.adminLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.adminLog.count({ where }),
  ]);
  return { logs, total };
}

// Deja registro de una acción del admin en el log de auditoría (/admin/logs).
// Se llama desde los server actions del panel, después de hacer el cambio.
// Nunca rompe la acción principal: si falla el log, solo se avisa por consola.
export async function logAdminAction(
  action: string,
  opts?: { targetType?: string; targetId?: string; detail?: string; adminEmail?: string; adminId?: string }
): Promise<void> {
  try {
    const session = await auth();
    await prisma.adminLog.create({
      data: {
        adminId: opts?.adminId ?? session?.user?.id ?? null,
        adminEmail: opts?.adminEmail ?? session?.user?.email ?? "desconocido",
        action,
        targetType: opts?.targetType,
        targetId: opts?.targetId,
        detail: opts?.detail,
      },
    });
  } catch (err) {
    console.error("logAdminAction failed", action, err);
  }
}
