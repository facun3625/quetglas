import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getAdminCounts } from '@/lib/adminCounts';
import { getSalesPage } from '@/lib/sales';
import { markOrdersSeen } from '../../src/app/admin/(dashboard)/ventas/actions';
import { setConversationHandled, deleteConversation } from '../../src/app/admin/(dashboard)/conversaciones/actions';

async function main() {
  for (const t of ['order', 'aiConversation', 'contactMessage', 'page'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();

  // ---- Campanita: solo cuentan los pedidos que nadie vio
  const mk = (id: string, seen: boolean, status: 'pending' | 'confirmed' = 'pending') =>
    prisma.order.create({ data: { id, customerName: `Cliente ${id}`, customerEmail: `${id}@example.com`, total: 100, paymentMethod: 'transferencia', status, adminSeenAt: seen ? new Date() : null } });
  await mk('o-a', false);
  await mk('o-b', false);
  await mk('o-c', true); // pendiente de confirmar, pero ya visto: no cuenta
  await mk('o-d', false, 'confirmed');

  let counts = await getAdminCounts();
  assert.equal(counts.newOrders, 3, 'cuentan los 3 sin ver, estén pendientes o confirmados');

  const page = await getSalesPage({ limit: 20, offset: 0 });
  assert.deepEqual(page.orders.filter((o) => !o.adminSeenAt).map((o) => o.id).sort(), ['o-a', 'o-b', 'o-d'], 'la lista sabe cuáles son nuevos');

  // Abrir Ventas marca como vistos los de la página; el estado del pedido no cambia
  await markOrdersSeen(['o-a', 'o-b']);
  counts = await getAdminCounts();
  assert.equal(counts.newOrders, 1);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: 'o-a' } })).status, 'pending', 'seguir pendiente no lo vuelve a "nuevo"');
  const seenAt = (await prisma.order.findUniqueOrThrow({ where: { id: 'o-a' } })).adminSeenAt!;
  await markOrdersSeen(['o-a', 'no-existe', '', 'x'.repeat(100)] as string[]);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: 'o-a' } })).adminSeenAt!.getTime(), seenAt.getTime(), 'no se vuelve a marcar uno ya visto');
  await markOrdersSeen(['o-d']);
  assert.equal((await getAdminCounts()).newOrders, 0);

  // Un pedido que entra después vuelve a contar
  await mk('o-e', false);
  assert.equal((await getAdminCounts()).newOrders, 1);

  // ---- Conversaciones con la vendedora IA
  const conv = (id: string, extra: Record<string, unknown>) => prisma.aiConversation.create({ data: { id, sessionId: `s-${id}`, ...extra } as never });
  await conv('c-1', { name: 'Ana', phone: '3425256898', messages: { create: [{ role: 'user', content: '¿Tienen picos?' }, { role: 'assistant', content: 'Sí, mirá estos', productIds: ['p1'] }] } });
  await conv('c-2', { name: 'Luis', phone: '3425111111', handledAt: new Date(), messages: { create: [{ role: 'user', content: 'Hola' }] } });
  await conv('c-3', { messages: { create: [{ role: 'user', content: 'Consulta anónima' }] } });
  await conv('c-4', { name: 'Solo datos', phone: '3425222222' }); // dejó sus datos y no escribió nada

  counts = await getAdminCounts();
  assert.equal(counts.pendingConversations, 2, 'con teléfono y sin atender: Ana y "Solo datos"');

  await setConversationHandled('c-1', true);
  assert.equal((await getAdminCounts()).pendingConversations, 1);
  await setConversationHandled('c-1', false);
  assert.equal((await getAdminCounts()).pendingConversations, 2, 'se puede volver a dejar pendiente');

  // Borrar una conversación se lleva sus mensajes y nada más
  const before = await prisma.aiMessage.count();
  await deleteConversation('c-1');
  assert.equal(await prisma.aiConversation.findUnique({ where: { id: 'c-1' } }), null);
  assert.equal(await prisma.aiMessage.count(), before - 2);
  assert.equal(await prisma.aiConversation.count(), 3);

  console.log('notifications-conversations e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
