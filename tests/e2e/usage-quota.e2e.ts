import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { addUsage, getUsageStatus, monthKey } from '@/lib/usage';
import { runCartRecovery } from '@/lib/cartRecoveryMail';
import { getSiteSettings } from '@/lib/settings';
import { createCampaign } from '../../src/app/admin/(dashboard)/mailing/actions';
import { updateUsageQuotas } from '../../src/app/admin/(dashboard)/configuracion/actions';

const H = 3600_000;
const sent: string[] = [];
const sender = { send: async (to: string) => { sent.push(to); return { ok: true }; } } as never;

async function main() {
  for (const t of ['abandonedCart', 'newsletterSubscriber', 'mailCampaign', 'monthlyUsage', 'product', 'storeSettings'] as const) await (prisma[t] as { deleteMany: () => Promise<unknown> }).deleteMany();
  process.env.AUTH_SECRET = 'e2e';
  process.env.NEXTAUTH_URL = 'https://tienda.example.com';

  // 1) El contador suma de a poco y es por mes
  await prisma.storeSettings.create({ data: { id: 'global', mailMonthlyQuota: 10, aiMonthlyTokenQuota: 5000, cartRecoveryEnabled: true, cartRecoveryDelayHours: 4 } });
  await addUsage('mail', 3);
  await addUsage('mail', 2);
  await addUsage('ai_tokens', 1200);
  await addUsage('mail', 0); // no hace nada
  await addUsage('mail', -4); // tampoco
  const old = new Date(Date.now() - 40 * 24 * H);
  await addUsage('mail', 99, old); // un mes viejo no cuenta en el actual
  let st = await getUsageStatus();
  assert.deepEqual([st.mail.used, st.mail.remaining, st.mail.pct, st.mail.warning], [5, 5, 50, false]);
  assert.deepEqual([st.ai.used, st.ai.remaining], [1200, 3800]);
  assert.equal((await prisma.monthlyUsage.count()), 3, 'una fila por mes y tipo');
  assert.equal(st.month, monthKey());

  // 2) Recuperación de carritos: con 1 mail de cupo restante manda uno solo y avisa; sin cupo no manda ninguno
  await prisma.product.create({ data: { id: 'p1', name: 'Pico', slug: 'pico', price: 1000, stock: 5, manageStock: true, status: 'published' } });
  const now = new Date();
  const mk = (id: string, email: string) =>
    prisma.abandonedCart.create({ data: { id, sessionId: `s-${id}`, items: [{ productId: 'p1', variantId: null, quantity: 1 }], total: 1000, email, lastActive: new Date(now.getTime() - 6 * H) } as never });
  await mk('c1', 'uno@example.com');
  await mk('c2', 'dos@example.com');
  await mk('c3', 'tres@example.com');

  await prisma.monthlyUsage.update({ where: { month_kind: { month: monthKey(), kind: 'mail' } }, data: { amount: 9 } }); // queda 1
  let r = await runCartRecovery(now, { sender });
  assert.equal(sent.length, 1, 'solo entra 1 mail en lo que queda del cupo');
  assert.equal(r.ok, false);
  assert.match(r.message ?? '', /cupo/i);

  sent.length = 0;
  await prisma.monthlyUsage.update({ where: { month_kind: { month: monthKey(), kind: 'mail' } }, data: { amount: 10 } }); // agotado
  r = await runCartRecovery(now, { sender });
  assert.equal(sent.length, 0, 'con el cupo agotado no sale ninguno');
  assert.equal(r.ok, false);

  // Sin cupo cargado: sin límite
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { mailMonthlyQuota: null } });
  r = await runCartRecovery(now, { sender });
  assert.equal(r.ok, true);
  assert.equal(sent.length, 2, 'los otros dos carritos salen cuando no hay límite');

  // 3) Campañas: no se arranca una que no entra en lo que queda del mes
  await prisma.newsletterSubscriber.createMany({ data: ['a', 'b', 'c', 'd'].map((n) => ({ email: `${n}@example.com` })) });
  const form = () => {
    const f = new FormData();
    f.set('subject', 'Novedades'); f.set('title', 'Hola'); f.set('body', '<p>Texto</p>'); f.append('audiences', 'subscribers');
    return f;
  };
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { mailMonthlyQuota: 12 } }); // usado 10 → quedan 2
  let c = await createCampaign(form());
  assert.equal(c.ok, false);
  assert.match(c.error ?? '', /Te quedan 2 mails/);
  assert.equal(await prisma.mailCampaign.count(), 0, 'no se crea la campaña');

  await prisma.storeSettings.update({ where: { id: 'global' }, data: { mailMonthlyQuota: 10 } }); // agotado
  c = await createCampaign(form());
  assert.equal(c.ok, false);
  assert.match(c.error ?? '', /agotó el cupo/i);

  await prisma.storeSettings.update({ where: { id: 'global' }, data: { mailMonthlyQuota: 20 } }); // quedan 10 → entra
  c = await createCampaign(form());
  assert.equal(c.ok, true);
  assert.equal(await prisma.mailCampaign.count(), 1);

  // 4) IA: con el cupo de tokens agotado la vendedora no se ofrece (queda WhatsApp); con cupo sí
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { aiAssistantEnabled: true, aiProvider: 'openai', aiApiKey: 'sk-test', aiMonthlyTokenQuota: 5000 } });
  assert.equal((await getSiteSettings()).assistant.enabled, true, 'quedan tokens');
  await addUsage('ai_tokens', 3800);
  assert.equal((await getSiteSettings()).assistant.enabled, false, 'cupo agotado: se apaga el chat');
  await prisma.storeSettings.update({ where: { id: 'global' }, data: { aiMonthlyTokenQuota: null } });
  assert.equal((await getSiteSettings()).assistant.enabled, true, 'sin cupo cargado: sin límite');

  // 5) El superadmin carga los cupos (vacío = sin límite; acepta puntos de miles)
  const q = new FormData();
  q.set('mailMonthlyQuota', '1.500'); q.set('aiMonthlyTokenQuota', '');
  await updateUsageQuotas(q);
  const row = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 'global' } });
  assert.deepEqual([row.mailMonthlyQuota, row.aiMonthlyTokenQuota], [1500, null]);

  console.log('usage-quota e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
