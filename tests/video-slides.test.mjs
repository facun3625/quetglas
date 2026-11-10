import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const load = loader();
const { checkVideoUrl, normalizeVideoUrl } = load('@/lib/video');
const { sanitizeThemeConfig } = load('@/lib/themes');

test('video: enlaces directos, Drive y Dropbox se normalizan; YouTube/Vimeo/http se rechazan', () => {
  assert.deepEqual(checkVideoUrl('https://cdn.example.com/a/b.mp4'), { url: 'https://cdn.example.com/a/b.mp4', source: 'directo' });
  const drive = checkVideoUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing');
  assert.equal(drive.url, 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp'); assert.equal(drive.source, 'drive'); assert.ok(drive.warning);
  assert.equal(checkVideoUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp').url, 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp');
  const dbx = checkVideoUrl('https://www.dropbox.com/s/abc123/video.mp4?dl=0');
  assert.equal(dbx.url, 'https://dl.dropboxusercontent.com/s/abc123/video.mp4?raw=1'); assert.equal(dbx.source, 'dropbox');
  assert.equal(checkVideoUrl('/api/uploads/videos/123e4567-e89b-12d3-a456-426614174000.mp4').source, 'propio');
  for (const bad of ['', 'http://x.com/a.mp4', 'https://www.youtube.com/watch?v=abc', 'https://youtu.be/abc', 'https://vimeo.com/123', 'https://photos.app.goo.gl/3qfhtdBKMy64V3bC6', 'https://photos.google.com/share/abc', 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp', 'https://1drv.ms/v/s!abc', 'javascript:alert(1)', 'https://x.com/a b.mp4', '/api/uploads/videos/../../etc/passwd.mp4']) {
    assert.ok('error' in checkVideoUrl(bad), `debería rechazar: ${bad}`);
  }
  assert.equal(normalizeVideoUrl('http://x.com/a.mp4'), '');
});

test('tema: un slide puede tener solo video; se descartan los inválidos; hasta 5 slides', () => {
  const slide = (extra) => ({ eyebrow: 'e', title: 'T', subtitle: '', promoText: '', buttons: [], ...extra });
  const cfg = sanitizeThemeConfig({ hero: [
    slide({ videoUrl: 'https://cdn.example.com/v.mp4' }),                 // solo video: válido
    slide({ image: 'https://x.test/i.webp', videoUrl: 'https://youtu.be/abc' }), // video inválido: queda la imagen
    slide({}),                                                            // sin imagen ni video: se descarta
    slide({ image: '/a.webp' }), slide({ image: '/b.webp' }), slide({ image: '/c.webp' }), slide({ image: '/d.webp' }),
  ] });
  assert.equal(cfg.hero.length, 5);
  assert.equal(cfg.hero[0].videoUrl, 'https://cdn.example.com/v.mp4'); assert.equal(cfg.hero[0].image, '');
  assert.equal(cfg.hero[1].videoUrl, ''); assert.equal(cfg.hero[1].image, 'https://x.test/i.webp');
});
