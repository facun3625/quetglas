// Configuración y tienda pública. Uso: node docs/manual/capturas-2.cjs [config|tienda]
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const open = require("./capturas-lib.cjs");
const only = process.argv.slice(2);
const wanted = (g) => only.length === 0 || only.includes(g);
(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/tienda_db(_e2e)?/, "/tienda_demo_e2e").replace(/\?.*$/, "") });
  await db.connect();
  const b = await open();
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); } };
  try {
    if (wanted("config")) {
      await b.as("super");
      const tabs = [["General", "cfg-general"], ["Beneficios", "cfg-beneficios"], ["Franquicia", "cfg-franquicia"], ["Copias de seguridad", "cfg-copias"], ["Mail de compra", "cfg-mail-compra"], ["Checkout y mensajes", "cfg-checkout"], ["Telegram", "cfg-telegram"], ["Vendedora IA", "cfg-ia"], ["Consumo", "cfg-consumo"], ["SEO y etiquetas", "cfg-seo"], ["Pop-up", "cfg-popup"]];
      for (const [label, id] of tabs) await step(id, async () => {
        await b.size(1200, 900); await b.go("/admin/configuracion", 1800); await b.click(label); await b.sleep(600);
        // el manual no cubre Correo ni Imágenes (R2) ni el proveedor de IA: se ocultan de la captura
        await b.js(`[...document.querySelectorAll('[role=tab]')].filter(t=>/^(Correo|Imágenes \\(R2\\))$/.test(t.textContent.trim())).forEach(t=>t.style.display='none');
          [...document.querySelectorAll('main p')].filter(p=>p.textContent.trim()==='Proveedor de IA').forEach(p=>{let e=p;while(e&&!/rounded-xl/.test(e.className||''))e=e.parentElement;if(e)e.remove()})`);
        if (id === "cfg-seo") { await b.size(1200, 1900); await b.shot(id, { clip: { x: 0, y: 0, width: 1200, height: 1560 } }); return; }
        await b.shot(id);
      });
    }
    if (wanted("tienda")) {
      await b.as(null);
      await step("home", async () => { await b.size(1280, 900); await b.go("/", 3000); await b.js(`document.querySelector('[role=dialog] button, button[aria-label*="errar"]')?.click()`); await b.sleep(600); await b.shot("tienda-home"); });
      await step("listado", async () => { await b.size(1280, 900); await b.go("/tienda", 2500); await b.shot("tienda-listado"); });
      await step("ficha", async () => { await b.size(1280, 900); await b.go("/producto/mochila-urbana", 2500); await b.shot("tienda-ficha"); });
      await step("movil", async () => {
        await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
        await b.go("/", 3000); await b.js(`document.querySelector('[role=dialog] button, button[aria-label*="errar"]')?.click()`); await b.sleep(600); await b.shot("tienda-movil", { clip: { x: 0, y: 0, width: 390, height: 640 } });
        await b.click("css:button[aria-label='Descargar Web App']"); await b.sleep(800); await b.shot("tienda-instalar");
      });
    }
    if (wanted("pwa")) {
      // Simula la app instalada (el navegador sin interfaz no puede instalarla de verdad)
      await b.as(null);
      await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `const mm=window.matchMedia.bind(window);window.matchMedia=q=>/display-mode: standalone/.test(q)?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q);` });
      await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
      await step("pwa-cartelito", async () => {
        await b.go("/", 3500);
        await b.js(`document.querySelector('button[aria-label="Cerrar"]')?.click()`);
        await b.sleep(600);
        await b.shot("pwa-cartelito", { clip: { x: 0, y: 380, width: 390, height: 400 } });
      });
      await step("pwa-pie", async () => {
        // pantalla muy alta para que la página entre entera, sin desplazarse: así el recorte sale bien
        await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 5400, deviceScaleFactor: 2, mobile: true });
        await b.go("/", 3500);
        await b.js(`document.querySelector('button[aria-label="Cerrar"]')?.click();[...document.querySelectorAll('button')].find(x=>x.innerText.trim()==='Ahora no')?.click()`);
        await b.sleep(700);
        const top = await b.js(`Math.round([...document.querySelectorAll('footer button')].find(x=>/Activar notificaciones/.test(x.innerText)).getBoundingClientRect().y)`);
        await b.shot("pwa-pie", { clip: { x: 0, y: Math.max(0, top - 230), width: 390, height: 330 } });
      });
    }
  } finally { b.close(); await db.end(); }
})();
