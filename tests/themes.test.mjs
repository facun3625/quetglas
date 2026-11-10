import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const mod = { exports: loader()('@/lib/themes') };
const { sanitizeThemeConfig, themeCss, themeFontHref, pickActiveTheme, themeStatus, isThemeLive, THEME_TEMPLATES, configFromTemplate, BASE_COLORS } = mod.exports;

const NOW = new Date('2026-12-10T12:00:00Z');
const d = (iso) => new Date(iso);
const theme = (id, over = {}) => ({ id, enabled: true, startsAt: null, endsAt: null, updatedAt: d('2026-01-01T00:00:00Z'), ...over });

test('sanitize: garbage input falls back to the base look', () => {
  for (const input of [null, undefined, 'x', 42, [], {}]) {
    const c = sanitizeThemeConfig(input);
    assert.deepEqual(c.colors, BASE_COLORS);
    assert.equal(c.headingFont, 'default'); assert.equal(c.buttonStyle, 'pill');
    assert.deepEqual(c.hero, []); assert.deepEqual(c.banners, []); assert.equal(c.announcement.enabled, false);
  }
});

test('sanitize: only #rrggbb colors and whitelisted fonts survive', () => {
  const c = sanitizeThemeConfig({ colors: { primary: 'red', primaryDark: '#E31269', ink: 'url(javascript:alert(1))', muted: '#12345', soft: '#FFF', background: '#000000' }, headingFont: 'comic-sans; } body{display:none', buttonStyle: 'weird' });
  assert.equal(c.colors.primary, BASE_COLORS.primary);
  assert.equal(c.colors.primaryDark, '#e31269', 'normaliza a minúsculas');
  assert.equal(c.colors.ink, BASE_COLORS.ink); assert.equal(c.colors.muted, BASE_COLORS.muted); assert.equal(c.colors.soft, BASE_COLORS.soft);
  assert.equal(c.colors.background, '#000000');
  assert.equal(c.headingFont, 'default'); assert.equal(c.buttonStyle, 'pill');
});

test('sanitize: URLs must be http(s) or site-relative with safe characters; limits and filters apply', () => {
  const c = sanitizeThemeConfig({
    backgroundImageUrl: 'https://cdn.x.com/fondo.webp",}</style><script>',
    announcement: { enabled: true, text: 'x'.repeat(500), href: 'javascript:alert(1)', bg: '#112233', color: 'nope' },
    hero: [
      { image: 'https://cdn.x.com/a.webp', title: 'Navidad', buttons: [{ label: 'Ver', href: '/tienda' }, { label: 'Mal', href: 'javascript:x' }, { label: '', href: '/x' }] },
      { image: 'javascript:alert(1)', title: 'sin imagen válida' },
      { image: '/uploads/b.webp', title: '' },
      ...Array.from({ length: 5 }, (_, i) => ({ image: `https://cdn.x.com/${i}.webp`, title: `T${i}` })),
    ],
    banners: [{ image: '//evil.com/x.png' }, { image: '/api/uploads/products/a.webp', title: 'T'.repeat(200), href: 'https://x.com/', alt: 'a'.repeat(300) }, ...Array.from({ length: 6 }, (_, i) => ({ image: `https://x.com/${i}.png` }))],
  });
  assert.equal(c.backgroundImageUrl, '', 'URL con comillas / etiquetas se descarta');
  assert.equal(c.announcement.text.length, 160); assert.equal(c.announcement.href, ''); assert.equal(c.announcement.bg, '#112233'); assert.equal(c.announcement.color, '#ffffff');
  assert.equal(c.hero.length, 5, 'máximo 5 slides'); assert.deepEqual(c.hero[0].buttons, [{ label: 'Ver', href: '/tienda' }]);
  assert.equal(c.hero.every((s) => s.image && s.title), true);
  assert.equal(c.banners.length, 6, 'máximo 6 tarjetas'); assert.equal(c.banners[0].title.length, 60); assert.equal(c.bannersTitle, ''); assert.equal(c.banners[0].image, '/api/uploads/products/a.webp'); assert.equal(c.banners[0].alt.length, 120);
});

test('css only contains validated values (no injection through colors, fonts or background)', () => {
  const evil = sanitizeThemeConfig({ colors: { primary: '#ff0000;}body{display:none' }, headingFont: 'x', backgroundImageUrl: 'https://x.com/a.png")}*{display:none' });
  const css = themeCss(evil);
  assert.ok(!css.includes('display:none')); assert.ok(!css.includes('url('), 'sin imagen de fondo válida no hay url()');
  const good = themeCss(sanitizeThemeConfig({ colors: { primary: '#0a0b0c' }, headingFont: 'bebas', buttonStyle: 'square', backgroundImageUrl: 'https://cdn.x.com/f.webp' }));
  assert.match(good, /--color-brand-pink:#0a0b0c/); assert.match(good, /Bebas Neue/); assert.match(good, /border-radius:0/); assert.match(good, /url\("https:\/\/cdn\.x\.com\/f\.webp"\)/);
  assert.equal(themeFontHref(sanitizeThemeConfig({ headingFont: 'bebas' })), 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
  assert.equal(themeFontHref(sanitizeThemeConfig({})), null);
});

test('window: enabled + date range decide when a theme is live', () => {
  assert.equal(isThemeLive(theme('a'), NOW), true);
  assert.equal(isThemeLive(theme('a', { enabled: false }), NOW), false);
  assert.equal(isThemeLive(theme('a', { startsAt: d('2026-12-20T00:00:00Z') }), NOW), false, 'todavía no empezó');
  assert.equal(isThemeLive(theme('a', { endsAt: d('2026-12-01T00:00:00Z') }), NOW), false, 'ya terminó');
  assert.equal(isThemeLive(theme('a', { startsAt: d('2026-12-01T00:00:00Z'), endsAt: d('2026-12-31T00:00:00Z') }), NOW), true);
});

test('active theme: the most recently started wins; none live => base look', () => {
  assert.equal(pickActiveTheme([], NOW), null);
  assert.equal(pickActiveTheme([theme('off', { enabled: false })], NOW), null);
  const navidad = theme('navidad', { startsAt: d('2026-12-01T00:00:00Z'), endsAt: d('2026-12-26T00:00:00Z') });
  const siempre = theme('siempre');
  const manual = theme('manual', { startsAt: d('2026-12-09T00:00:00Z') });
  assert.equal(pickActiveTheme([siempre, navidad], NOW).id, 'navidad', 'el programado con inicio gana al sin fecha');
  assert.equal(pickActiveTheme([siempre, navidad, manual], NOW).id, 'manual', 'activado a mano más tarde gana');
  assert.equal(pickActiveTheme([navidad], d('2027-01-05T00:00:00Z')), null, 'después del fin vuelve al tema base');
  assert.equal(pickActiveTheme([navidad], d('2026-11-20T00:00:00Z')), null, 'antes del inicio todavía no');
  const tie = [theme('viejo', { updatedAt: d('2026-01-01T00:00:00Z') }), theme('nuevo', { updatedAt: d('2026-06-01T00:00:00Z') })];
  assert.equal(pickActiveTheme(tie, NOW).id, 'nuevo');
});

test('status labels', () => {
  assert.equal(themeStatus(theme('a', { enabled: false }), null, NOW), 'inactive');
  assert.equal(themeStatus(theme('a', { startsAt: d('2027-01-01T00:00:00Z') }), null, NOW), 'scheduled');
  assert.equal(themeStatus(theme('a', { endsAt: d('2026-01-01T00:00:00Z') }), null, NOW), 'expired');
  assert.equal(themeStatus(theme('a'), 'a', NOW), 'live');
  assert.equal(themeStatus(theme('b'), 'a', NOW), 'overridden');
});

test('every template is a valid, sanitized theme', () => {
  assert.ok(THEME_TEMPLATES.length >= 7);
  for (const t of THEME_TEMPLATES) {
    const c = configFromTemplate(t.key);
    assert.equal(c.announcement.enabled, true, t.key); assert.ok(c.announcement.text, t.key);
    assert.deepEqual(sanitizeThemeConfig(c), c, `${t.key} ya está saneada`);
    assert.notDeepEqual(c.colors, BASE_COLORS, `${t.key} cambia la paleta`);
  }
});
