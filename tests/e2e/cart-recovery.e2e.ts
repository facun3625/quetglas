import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { runCartRecovery, optOutUrl, verifyOptOut } from '@/lib/cartRecoveryMail';

const H = 3600_000;
const sent: { to: string; subject: string; html: string }[] = [];
let failing = false;
const sender = { send: async (to: string, subject: string, html: string) => { if (failing) return { ok: false, error: 'SMTP caído' }; sent.push({ to, subject, html }); return { ok: true }; } } as never;

async function main() {
  process.env.AUTH_SECRET = 'secreto-de-prueba-e2e';
  process.env.NEXTAUTH_URL = 'https://tienda.example.com';
  for (const t of ['abandonedCart', 'cartRecoveryOptOut', 'order', 'product', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();

  const product = await prisma.product.create({ data: { id: 'p1', name: 'Pico de glasear', slug: 'pico', price: 1000, stock: 5, manageStock: true, status: 'published' } });
  const noStock = await prisma.product.create({ data: { id: 'p2', name: 'Agotado', slug: 'agotado', price: 500, stock: 0, manageStock: true, status: 'published' } });
  await prisma.user.deleteMany({ where: { id: 'u-rec' } });
  await prisma.user.create({ data: { id: 'u-rec', email: 'registrada@example.com', name: 'Laura Gómez', role: 'customer' } });

  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * H);
  const mk = (id: string, over: Record<string, unknown>) =>
    prisma.abandonedCart.create({ data: { id, sessionId: `s-${id}`, items: [{ productId: product.id, variantId: null, quantity: 2 }], total: 2000, lastActive: ago(6), ...over } as never });

  await mk('c-ok', { email: 'ok@example.com', name: 'Ana Pérez' });
  await mk('c-user', { userId: 'u-rec' });
  await mk('c-reciente', { email: 'reciente@example.com', lastActive: ago(1) });
  await mk('c-vieja', { email: 'vieja@example.com', lastActive: ago(24 * 5) });
  await mk('c-anonimo', {});
  await mk('c-baja', { email: 'baja@example.com' });
  await mk('c-compro', { email: 'compro@example.com' });
  await mk('c-sinstock', { email: 'sinstock@example.com', items: [{ productId: noStock.id, variantId: null, quantity: 1 }] });
  await mk('c-invalido', { email: 'no-es-un-mail' });
  await prisma.cartRecoveryOptOut.create({ data: { email: 'baja@example.com' } });
  await prisma.order.create({ data: { id: 'o-rec', customerName: 'X', customerEmail: 'Compro@Example.com', total: 10, paymentMethod: 'transferencia' } });

  // 1) apagado: no manda nada
  await prisma.storeSettings.create({ data: { id: 'global', cartRecoveryEnabled: false, cartRecoveryDelayHours: 4 } });
  let r = await runCartRecovery(now, { sender });
  assert.deepEqual([r.ok, r.sent, sent.length], [true, 0, 0], 'suspendido = no se manda nada');

  // 2) sin correo configurado
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { cartRecoveryEnabled: true } });
  r = await runCartRecovery(now, { sender: null });
  assert.equal(r.ok, false);
  assert.equal(sent.length, 0);

  // 3) prendido: solo los carritos elegibles
  r = await runCartRecovery(now, { sender });
  const to = sent.map((s) => s.to).sort();
  assert.deepEqual(to, ['ok@example.com', 'registrada@example.com'], `destinatarios: ${to}`);
  assert.equal(r.sent, 2);
  const mail = sent.find((s) => s.to === 'ok@example.com')!;
  assert.match(mail.html, /Pico de glasear/);
  assert.match(mail.html, /2 × Pico de glasear/);
  assert.match(mail.html, /Hola, Ana/);
  assert.match(mail.html, /\/carrito\?recuperar=c-ok/);
  assert.match(mail.html, /No quiero recibir más recordatorios/);
  assert.match(sent.find((s) => s.to === 'registrada@example.com')!.html, /Hola, Laura/, 'usa el nombre de la cuenta');

  // el envío no cuenta como actividad del cliente (lastActive no cambia) y queda registrado
  const c = await prisma.abandonedCart.findUniqueOrThrow({ where: { id: 'c-ok' } });
  assert.ok(c.recoveryEmailSentAt);
  assert.equal(c.lastActive.getTime(), ago(6).getTime());

  // 4) segundo pase: no repite
  sent.length = 0;
  r = await runCartRecovery(now, { sender });
  assert.equal(sent.length, 0, 'un solo mail por carrito');

  // 5) si lo vuelve a tocar y pasan 3 días, puede recibir otro; antes no
  await prisma.abandonedCart.update({ where: { id: 'c-ok' }, data: { items: [{ productId: product.id, variantId: null, quantity: 3 }], lastActive: ago(5) } });
  r = await runCartRecovery(now, { sender });
  assert.equal(sent.length, 0, 'todavía no pasaron 3 días desde el último mail');
  const later = new Date(now.getTime() + 3 * 24 * H + H);
  await prisma.abandonedCart.update({ where: { id: 'c-ok' }, data: { lastActive: new Date(later.getTime() - 6 * H) } });
  r = await runCartRecovery(later, { sender });
  assert.deepEqual(sent.map((s) => s.to), ['ok@example.com']);

  // 6) si el envío falla se libera para reintentar y se corta
  sent.length = 0;
  await mk('c-falla', { email: 'falla@example.com' });
  failing = true;
  r = await runCartRecovery(now, { sender });
  assert.equal(r.ok, false);
  assert.equal((await prisma.abandonedCart.findUniqueOrThrow({ where: { id: 'c-falla' } })).recoveryEmailSentAt, null, 'queda pendiente para el próximo pase');
  failing = false;
  r = await runCartRecovery(now, { sender });
  assert.ok(sent.some((s) => s.to === 'falla@example.com'));

  // 7) la baja: firma válida, y no se puede dar de baja a otra persona
  const url = new URL(optOutUrl('Alguien@Example.com'));
  const e = url.searchParams.get('e')!;
  assert.equal(e, 'alguien@example.com');
  assert.ok(verifyOptOut(e, url.searchParams.get('s')!));
  assert.ok(!verifyOptOut('otra@example.com', url.searchParams.get('s')!));
  assert.ok(!verifyOptOut(e, 'firma-falsa'));

  console.log('cart-recovery e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
