import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loader(stubs = {}) {
  const cache = new Map();
  function load(name) {
    if (name in stubs) return stubs[name];
    if (!name.startsWith('@/')) return require(name);
    if (cache.has(name)) return cache.get(name).exports;
    const source = readFileSync(`src/${name.slice(2)}.ts`, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    cache.set(name, mod);
    vm.runInThisContext(`(function(require, module, exports) {${code}\n})`)(load, mod, mod.exports);
    return mod.exports;
  }
  return load;
}

test('storeImage converts to webp, makes a thumbnail and stores both (local mode)', async () => {
  const sharp = require('sharp');
  const written = [];
  for (const key of ['R2_ACCOUNT_ID', 'R2_BUCKET']) delete process.env[key];
  const { storeImage } = loader({ '@/lib/prisma': { prisma: { storeSettings: { findUnique: async () => null } } }, 'node:fs/promises': { mkdir: async () => {}, writeFile: async (file, body) => written.push([file, body]) } })('@/lib/storage');
  const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c33' } }).png().toBuffer();
  const result = await storeImage(png);
  assert.match(result.url, /^\/api\/uploads\/products\/products_\d{4}-\d{2}_.+\.webp$/);
  assert.match(result.thumbUrl, /-thumb\.webp$/);
  assert.equal(written.length, 2);
  const main = await sharp(written[0][1]).metadata();
  const thumb = await sharp(written[1][1]).metadata();
  assert.equal(main.format, 'webp');
  assert.equal(main.width, 1600);
  assert.equal(thumb.width, 400);
  assert.equal(thumb.height, 400);
});

test('storeImage rejects files that are not images', async () => {
  const { storeImage } = loader({ '@/lib/prisma': { prisma: { storeSettings: { findUnique: async () => null } } }, 'node:fs/promises': { mkdir: async () => {}, writeFile: async () => {} } })('@/lib/storage');
  await assert.rejects(storeImage(Buffer.from('<script>alert(1)</script>')), /no es una imagen válida/);
});

test('downloadImage blocks private hosts and non-http protocols (SSRF)', async () => {
  const { downloadImage } = loader()('@/lib/remoteImage');
  for (const url of ['http://127.0.0.1/a.png', 'http://localhost/a.png', 'http://10.0.0.5/a.png', 'http://192.168.1.1/a.png', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/a.png', 'file:///etc/passwd', 'ftp://example.com/a.png']) {
    await assert.rejects(downloadImage(url), /no permitid/i, url);
  }
});
