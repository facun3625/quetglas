import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { ensureBaseTheme } from '@/lib/baseTheme';
import { sanitizeThemeConfig } from '@/lib/themes';
import * as t from '@/app/admin/(dashboard)/temas/actions';

async function main() {
  await prisma.theme.deleteMany(); await prisma.heroSlide.deleteMany();
  assert.equal(await ensureBaseTheme(), null, 'sin base ni slides viejos: nada que crear');

  await prisma.heroSlide.createMany({ data: [
    { position: 0, eyebrow: 'Nueva', title: 'Bienvenido\na la tienda', subtitle: 'Sub', promoText: 'Nueva\nColección', imageUrl: 'https://x.test/a.webp', button1Label: 'Ver todo', button1Href: '/tienda', button2Label: 'Solo texto' },
    { position: 1, eyebrow: 'Oculto', title: 'No va', enabled: false },
    { position: 2, eyebrow: 'Otra', title: 'Segundo' },
  ] });
  // dos pedidos a la vez: se crea UN solo aspecto base
  const [a, b] = await Promise.all([ensureBaseTheme(), ensureBaseTheme()]);
  assert.ok(a && b);
  assert.equal(await prisma.theme.count({ where: { isBase: true } }), 1, 'un solo aspecto base');
  const base = await prisma.theme.findFirstOrThrow({ where: { isBase: true } });
  const hero = sanitizeThemeConfig(base.config).hero;
  assert.equal(hero.length, 2, 'solo los slides habilitados');
  assert.equal(hero[0].title, 'Bienvenido\na la tienda'); assert.equal(hero[0].image, 'https://x.test/a.webp'); assert.equal(hero[0].promoText, 'Nueva\nColección');
  assert.deepEqual(hero[0].buttons, [{ label: 'Ver todo', href: '/tienda' }], 'botones sin enlace se descartan');
  assert.equal(hero[1].image, '/hero-bg.jpg', 'sin imagen usa la de fábrica');
  assert.equal(base.enabled, true);

  // abrir el aspecto base desde el panel devuelve el mismo
  assert.equal((await t.openBaseTheme()).id, base.id);

  // guardar un slide con video en el aspecto base
  const cfg = sanitizeThemeConfig(base.config);
  cfg.hero.push({ image: '', videoUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view', eyebrow: '', title: 'Con video', subtitle: '', promoText: '', buttons: [] });
  assert.equal((await t.saveTheme({ id: base.id, name: 'x', description: '', startsAt: '', endsAt: '', config: cfg })).ok, true);
  const saved = sanitizeThemeConfig((await prisma.theme.findUniqueOrThrow({ where: { id: base.id } })).config).hero;
  assert.equal(saved.length, 3); assert.equal(saved[2].videoUrl, 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp');
  console.log('hero themes e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
