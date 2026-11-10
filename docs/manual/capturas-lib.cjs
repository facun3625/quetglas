// Utilidades para sacar las capturas del manual con un Chrome real (CDP). Uso interno de docs/manual/capturas.cjs.
require("dotenv").config({ quiet: true });
const WebSocket = require("ws");
const sharp = require("sharp");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.MANUAL_BASE || "http://localhost:3000";
const OUT = __dirname + "/shots";
const LEAK = /cortopass|cortopac|moda ?shop|facundo|arteaga|santa fe/i;

module.exports = async function open() {
  const { encode } = await import("next-auth/jwt");
  const cookie = async (id, role, email) => encode({ token: { sub: id, id, role: role === "super" ? "superadmin" : role, email, name: role === "super" ? "Superadministrador" : "Administrador" }, secret: process.env.AUTH_SECRET, salt: "authjs.session-token" });
  const tokens = {
    admin: await cookie("admin-demo", "admin", "admin@tutienda.com"),
    super: await cookie("superadmin-facundo", "superadmin", "super@tutienda.com"),
  };
  const port = 9500 + Math.floor(Math.random() * 300);
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=" + port, "--window-size=1200,800", "--user-data-dir=/tmp/manual-chrome-" + port, "about:blank"], { stdio: "ignore" });
  let targets;
  for (let i = 0; i < 30; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.on("open", r));
  let n = 0;
  const pending = new Map();
  ws.on("message", (m) => { const d = JSON.parse(m); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++n; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Network.enable");
  await send("Page.enable");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error("JS: " + JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 300));
    return r.result?.result?.value;
  };
  const api = {
    sleep, js, send,
    async as(role) {
      await send("Network.clearBrowserCookies");
      if (role) await send("Network.setCookie", { name: "authjs.session-token", value: tokens[role], url: BASE + "/", path: "/" });
    },
    // Entra como una persona puntual de la base (por ejemplo, una clienta de la demostración)
    async asUser(id, role, email, name) {
      await send("Network.clearBrowserCookies");
      const value = await encode({ token: { sub: id, id, role, email, name }, secret: process.env.AUTH_SECRET, salt: "authjs.session-token" });
      await send("Network.setCookie", { name: "authjs.session-token", value, url: BASE + "/", path: "/" });
    },
    async size(width, height) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); },
    async go(path, wait = 1800) {
      await send("Page.navigate", { url: BASE + path });
      await sleep(wait);
      // oculta el indicador de desarrollo de Next y deja la página lista para fotografiar
      await js(`(()=>{document.querySelectorAll('nextjs-portal').forEach(e=>e.remove());const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important} *{caret-color:transparent!important} a[href="/admin/migracion"]{display:none!important}';document.head.appendChild(s)})()`);
    },
    // clic en un botón o enlace por su texto (exacto) o por un selector
    async click(target, root = "document") {
      const ok = await js(`(()=>{const t=${JSON.stringify(target)};const r=${root};let el=null;
        if(t.startsWith('css:')) el=r.querySelector(t.slice(4));
        else el=[...r.querySelectorAll('button,a,[role=tab],[role=radio],label,summary')].find(e=>e.textContent.replace(/\\s+/g,' ').trim()===t)||[...r.querySelectorAll('button,a,[role=tab],summary')].find(e=>e.textContent.replace(/\\s+/g,' ').trim().startsWith(t));
        if(!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true})()`);
      if (!ok) throw new Error("No encontré para hacer clic: " + target);
    },
    async setValue(selector, value, kind = "Input") {
      const ok = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;Object.getOwnPropertyDescriptor(HTML${kind}Element.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(${JSON.stringify(kind === "Select" ? "change" : "input")},{bubbles:true}));return true})()`);
      if (!ok) throw new Error("No encontré el campo: " + selector);
    },
    async scrollMain(y) { await js(`(()=>{const m=document.querySelector('main');if(m)m.scrollTop=${y}})()`); await sleep(250); },
    async scrollTo(selector, block = "start") { await js(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:${JSON.stringify(block)}})`); await sleep(250); },
    // Foto de la pantalla (o de un recorte). opts: {clip:{x,y,width,height}} o {el:selector,pad}
    async shot(id, opts = {}) {
      let clip = opts.clip;
      if (opts.card) {
        const sel = await js(`(()=>{const p=[...document.querySelectorAll('main p')].find(x=>x.textContent.trim().startsWith(${JSON.stringify(opts.card)}));if(!p)return null;let e=p;while(e&&!/rounded-xl/.test(e.className||''))e=e.parentElement;if(!e)return null;e.setAttribute('data-shot-card','1');return '[data-shot-card]'})()`);
        if (!sel) throw new Error("No encontré la tarjeta: " + opts.card);
        opts = { ...opts, el: sel };
      }
      if (opts.el) {
        const r = await js(`(()=>{const e=document.querySelector(${JSON.stringify(opts.el)});if(!e)return null;e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()`);
        if (!r) throw new Error("No encontré el elemento para recortar: " + opts.el);
        await sleep(250);
        const r2 = await js(`(()=>{const e=document.querySelector(${JSON.stringify(opts.el)});const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()`);
        const pad = opts.pad ?? 12;
        clip = { x: Math.max(0, r2.x - pad), y: Math.max(0, r2.y - pad), width: r2.w + pad * 2, height: r2.h + pad * 2 };
      }
      const text = await js(`document.body.innerText`);
      const leak = text.match(LEAK);
      if (leak) console.log(`  ⚠ MARCA en "${id}":`, leak[0]);
      const params = { format: "png" };
      if (clip) params.clip = { ...clip, scale: 1 };
      const s = await send("Page.captureScreenshot", params);
      const png = Buffer.from(s.result.data, "base64");
      const file = `${OUT}/${id}.webp`;
      await sharp(png).webp({ quality: 80 }).toFile(file);
      await js(`document.querySelectorAll('[data-shot-card]').forEach(e=>e.removeAttribute('data-shot-card'))`).catch(() => {});
      const kb = Math.round(fs.statSync(file).size / 1024);
      console.log(`  ✓ ${id} (${kb} KB)`);
      return file;
    },
    close() { try { ws.close(); } catch {} proc.kill(); try { execSync("rm -rf /tmp/manual-chrome-" + port); } catch {} },
  };
  return api;
};
