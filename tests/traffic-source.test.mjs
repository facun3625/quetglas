import test from "node:test";
import assert from "node:assert/strict";
import { loader } from "./helpers/loader.mjs";

const { classifyTraffic, sourceLabel } = loader()("@/lib/trafficSource");
const c = (o) => classifyTraffic({ siteHost: "tienda.com.ar", ...o });

test("sin referrer ni parámetros es directo", () => {
  assert.deepEqual({ ...c({}) }, { channel: "directo", paid: false, campaign: null, referrerHost: null });
  assert.equal(c({ referrer: "https://tienda.com.ar/tienda" }).channel, "directo", "un referrer de la propia tienda no cuenta como origen");
  assert.equal(c({ referrer: "https://www.tienda.com.ar/" }).channel, "directo");
});

test("redes por el sitio que refiere", () => {
  assert.equal(c({ referrer: "https://l.instagram.com/?u=..." }).channel, "instagram");
  assert.equal(c({ referrer: "https://m.facebook.com/" }).channel, "facebook");
  assert.equal(c({ referrer: "https://l.facebook.com/l.php" }).channel, "facebook");
  assert.equal(c({ referrer: "https://t.co/abc" }).channel, "x");
  assert.equal(c({ referrer: "https://www.tiktok.com/" }).channel, "tiktok");
  assert.equal(c({ referrer: "https://wa.me/549111" }).channel, "whatsapp");
  assert.equal(c({ referrer: "https://www.youtube.com/watch" }).channel, "youtube");
});

test("buscadores: Google orgánico, Google Ads y otros", () => {
  assert.deepEqual({ ...c({ referrer: "https://www.google.com.ar/" }) }, { channel: "google", paid: false, campaign: null, referrerHost: null });
  assert.equal(c({ referrer: "https://www.google.com/", search: "?gclid=abc" }).paid, true);
  assert.equal(c({ search: "?gclid=abc" }).channel, "google");
  assert.equal(c({ referrer: "https://www.bing.com/search?q=x" }).channel, "buscadores");
  assert.equal(c({ referrer: "https://duckduckgo.com/" }).channel, "buscadores");
});

test("UTM manda sobre el referrer, y distingue publicidad de orgánico", () => {
  const bio = c({ referrer: "https://l.instagram.com/", search: "?utm_source=instagram&utm_medium=bio&utm_campaign=Dia de la Madre" });
  assert.equal(bio.channel, "instagram"); assert.equal(bio.paid, false); assert.equal(bio.campaign, "Dia de la Madre");
  const ad = c({ search: "?utm_source=facebook&utm_medium=cpc&fbclid=x" });
  assert.equal(ad.channel, "facebook"); assert.equal(ad.paid, true);
  assert.equal(c({ search: "?utm_source=ig&utm_medium=paid_social" }).paid, true);
  assert.equal(c({ search: "?utm_source=ig_ads" }).paid, true, "fuente con ads");
  assert.equal(c({ search: "?utm_source=newsletter&utm_medium=email" }).channel, "email");
  assert.equal(c({ search: "?utm_source=whatsapp&utm_medium=mensaje" }).channel, "whatsapp");
  assert.equal(c({ search: "?utm_source=push" }).channel, "push");
  const other = c({ search: "?utm_source=blogamigo" });
  assert.equal(other.channel, "otro"); assert.equal(other.referrerHost, "blogamigo");
});

test("fbclid solo no implica publicidad; el navegador interno de la app también identifica", () => {
  const f = c({ search: "?fbclid=abc" });
  assert.equal(f.channel, "facebook"); assert.equal(f.paid, false);
  assert.equal(c({ userAgent: "Mozilla/5.0 (iPhone) AppleWebKit Instagram 300.0 (iPhone14,2)" }).channel, "instagram");
  assert.equal(c({ userAgent: "Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]" }).channel, "facebook");
  assert.equal(c({ userAgent: "Mozilla/5.0 Chrome" }).channel, "directo");
});

test("mail webmail y otros sitios", () => {
  assert.equal(c({ referrer: "https://mail.google.com/" }).channel, "email", "Gmail no es Google");
  const site = c({ referrer: "https://www.blogdemoda.com/nota" });
  assert.equal(site.channel, "sitio"); assert.equal(site.referrerHost, "blogdemoda.com");
});

test("etiquetas legibles", () => {
  assert.equal(sourceLabel("instagram", false), "Instagram (orgánico)");
  assert.equal(sourceLabel("instagram", true), "Instagram (publicidad)");
  assert.equal(sourceLabel("google", false), "Google (búsqueda orgánica)");
  assert.equal(sourceLabel("directo", false), "Directo");
  assert.equal(sourceLabel("email", false), "Email");
});
