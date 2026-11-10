import { prisma } from "@/lib/prisma";

// Números que se ven en el menú y en la campanita del panel (consultas baratas: solo conteos).
//  - newOrders: pedidos que ningún administrador vio todavía. Se apagan solos al abrir Ventas (ver Order.adminSeenAt);
//    los pedidos que siguen "pendientes" de confirmación ya NO cuentan acá: para eso está el aviso del inicio.
//  - unreadMessages: mensajes del formulario de contacto sin leer.
//  - pendingConversations: conversaciones de la vendedora de IA que dejaron teléfono y todavía no se marcaron como atendidas.
// showMessages: la sección Mensajes solo se muestra si hay algo que ver: mensajes guardados o una página pública con el
// formulario de contacto activo (si no existe ningún formulario, esa bandeja nunca se llenaría).
export type AdminCounts = { newOrders: number; unreadMessages: number; pendingConversations: number; showMessages: boolean };

export async function getAdminCounts(): Promise<AdminCounts> {
  const [newOrders, unreadMessages, totalMessages, activeForms, pendingConversations] = await Promise.all([
    prisma.order.count({ where: { adminSeenAt: null } }),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.contactMessage.count(),
    prisma.page.count({ where: { enabled: true, showContactForm: true } }),
    prisma.aiConversation.count({ where: { phone: { not: null }, handledAt: null } }),
  ]);
  return { newOrders, unreadMessages, pendingConversations, showMessages: totalMessages > 0 || activeForms > 0 };
}
