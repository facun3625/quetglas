import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getVisitStats } from '@/lib/visits';
import { POST } from '../../src/app/api/track/route';

const track = (body: unknown, ua = 'Mozilla/5.0 Chrome') =>
  POST(new Request('https://tienda.com.ar/api/track', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': ua, host: 'tienda.com.ar' }, body: JSON.stringify(body) }));

async function main() {
  await prisma.pageView.deleteMany();
  // sesión A: llega desde el link de la bio de Instagram y después navega
  await track({ path: '/', sessionId: 's-a', landing: { referrer: 'https://l.instagram.com/', search: '?utm_source=instagram&utm_medium=bio&utm_campaign=dia-de-la-madre' } });
  await track({ path: '/tienda', sessionId: 's-a' });
  // B: anuncio pago de Facebook; C: Google orgánico; D: directo; E: dos llegadas el mismo período (cuenta la primera); F: sin dato de origen (dato anterior)
  await track({ path: '/', sessionId: 's-b', landing: { referrer: 'https://l.facebook.com/', search: '?utm_source=facebook&utm_medium=cpc&utm_campaign=ofertas&fbclid=x' } });
  await track({ path: '/', sessionId: 's-c', landing: { referrer: 'https://www.google.com/', search: '' } });
  await track({ path: '/', sessionId: 's-d', landing: { referrer: '', search: '' } });
  await track({ path: '/', sessionId: 's-e', landing: { referrer: 'https://www.blogdemoda.com/nota', search: '' } });
  await track({ path: '/', sessionId: 's-e', landing: { referrer: 'https://l.instagram.com/', search: '' } });
  await prisma.pageView.create({ data: { path: '/', sessionId: 's-f' } });
  await track({ path: '/', sessionId: 's-g', landing: { referrer: '', search: '' } }, 'Mozilla/5.0 (iPhone) Instagram 300.0');

  const rows = await prisma.pageView.findMany({ where: { sessionId: 's-a' }, orderBy: { createdAt: 'asc' } });
  assert.equal(rows[0].isLanding, true); assert.equal(rows[0].channel, 'instagram'); assert.equal(rows[0].campaign, 'dia-de-la-madre');
  assert.equal(rows[1].isLanding, false, 'solo la llegada guarda el origen'); assert.equal(rows[1].channel, null);

  const stats = await getVisitStats({ granularity: 'day' });
  const by = (ch: string, paid = false) => stats.sources.find((s) => s.channel === ch && s.paid === paid)?.count ?? 0;
  assert.equal(stats.visits, 7);
  assert.equal(by('instagram'), 2, 'la bio (A) y el navegador interno de Instagram (G); la segunda llegada de E no suma');
  assert.equal(by('facebook', true), 1, 'anuncio pago');
  assert.equal(by('google'), 1);
  assert.equal(by('directo'), 1);
  assert.equal(by('sitio'), 1, 'E: se cuenta su primera llegada (el blog)');
  assert.equal(stats.noSource, 1, 'F es anterior a la función');
  assert.deepEqual(stats.campaigns.map((c) => c.campaign).sort(), ['dia-de-la-madre', 'ofertas']);
  assert.deepEqual(stats.referrerHosts, [{ host: 'blogdemoda.com', count: 1 }]);
  console.log('visit sources e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
