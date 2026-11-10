import test from "node:test";
import assert from "node:assert/strict";
import { loader } from "./helpers/loader.mjs";

const { cleanGaId, cleanGtmId, cleanPixelId, cleanVerificationCode, parseCustomTags } = loader()("@/lib/seoTags");

test("IDs de medición: solo formatos válidos", () => {
  assert.equal(cleanGaId(" g-abc123def4 "), "G-ABC123DEF4");
  assert.equal(cleanGaId("UA-123"), null);
  assert.equal(cleanGaId('G-1234"><script>'), null);
  assert.equal(cleanGtmId("gtm-abc123"), "GTM-ABC123");
  assert.equal(cleanGtmId("x"), null);
  assert.equal(cleanPixelId("1234567890123456"), "1234567890123456");
  assert.equal(cleanPixelId("12ab"), null);
});

test("verificación: acepta el código o la etiqueta completa", () => {
  assert.equal(cleanVerificationCode("abcDEF123456_-"), "abcDEF123456_-");
  assert.equal(cleanVerificationCode('<meta name="google-site-verification" content="xyz987xyz987" />'), "xyz987xyz987");
  assert.equal(cleanVerificationCode("corto"), null);
  assert.equal(cleanVerificationCode('"><script>alert(1)</script>'), null);
});

test("etiquetas propias: meta/link/script admitidos, lo peligroso se descarta", () => {
  const html = `<!-- comentario -->
    <meta property="fb:app_id" content="123" />
    <meta name='p:domain_verify' content=abc onload="x()">
    <link rel="preconnect" href="https://fonts.example.com">
    <link rel="stylesheet" href="http://inseguro.com/a.css">
    <script src="https://cdn.example.com/a.js" async></script>
    <script src="javascript:alert(1)"></script>
    <script>window.x = 1;</script>
    <noscript><img src="https://x.com/p.gif"></noscript>
    <iframe src="https://evil.com"></iframe>`;
  const { tags, ignored } = parseCustomTags(html);
  assert.deepEqual(tags.map((t) => t.kind), ["meta", "meta", "link", "script", "script"]);
  assert.equal(ignored, 2, "link http y script con javascript: se descartan; noscript/iframe se omiten sin contar");
  assert.equal(tags[1].attrs.onload, undefined, "se sacan los atributos on*");
  assert.equal(tags[4].inline, "window.x = 1;");
});

test("etiquetas propias: vacío o nulo no rompe", () => {
  assert.deepEqual(parseCustomTags(null), { tags: [], ignored: 0 });
  assert.equal(parseCustomTags("x".repeat(20000)).tags.length, 0);
});
