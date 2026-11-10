// La tienda vista por el comprador (demostración). Uso: node docs/manual/capturas-3.cjs [grupo]
// Grupos: visitante, compra, cuenta, extras
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const open = require("./capturas-lib.cjs");
const only = process.argv.slice(2);
const wanted = (g) => only.length === 0 || only.includes(g);

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/tienda_db(_e2e)?/, "/tienda_demo_e2e").replace(/\?.*$/, "") });
  await db.connect();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const b = await open();
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); } };
  const closePopup = () => b.js(`document.querySelector('button[aria-label="Cerrar"]')?.click()`);
  try {
    const sofia = await one(`select id,email,name from "User" where email='sofia.martinez@example.com'`);
    const slugOf = async (name) => (await one(`select slug from "Product" where name=$1`, [name])).slug;

    if (wanted("visitante")) {
      await b.as(null);
      await step("buscador", async () => {
        await b.size(1280, 700); await b.go("/", 3500); await closePopup(); await b.sleep(500);
        // se escribe como una persona: foco y teclas reales, para que aparezca la lista de sugerencias
        await b.js(`document.querySelector("header input[placeholder^='Buscar productos']").focus()`);
        await b.send("Input.insertText", { text: "mochi" }); await b.sleep(2000);
        await b.shot("front-buscador", { clip: { x: 640, y: 0, width: 640, height: 420 } });
      });
      await step("ficha-variable", async () => {
        await b.size(1280, 900); await b.go("/producto/" + (await slugOf("Remera básica de algodón")), 3000); await closePopup(); await b.sleep(400);
        await b.shot("front-ficha-variable");
      });
      await step("avisarme", async () => {
        await b.size(1280, 800); await b.go("/producto/" + (await slugOf("Manta tejida")), 3000); await closePopup(); await b.sleep(400);
        await b.click("Avisarme cuando haya stock"); await b.sleep(700);
        await b.shot("front-avisarme");
      });
      await step("login", async () => {
        await b.size(1280, 800); await b.go("/", 3000); await closePopup(); await b.sleep(400);
        await b.click("css:button[title='Iniciar sesión'],a[title='Iniciar sesión']"); await b.sleep(800);
        await b.shot("front-login");
        await b.click("Regístrate").catch(() => b.click("Registrate")); await b.sleep(600);
        await b.shot("front-registro");
      });
      await step("movil-menu", async () => {
        await b.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 2, mobile: true });
        await b.go("/", 3000); await closePopup(); await b.sleep(400);
        await b.click("css:button[aria-label='Abrir menú']"); await b.sleep(700);
        await b.shot("front-menu-movil");
      });
    }

    if (wanted("compra")) {
      await b.as("cliente-se-define-abajo");
      await b.asUser(sofia.id, "customer", sofia.email, sofia.name);
      await step("carrito-drawer", async () => {
        await b.size(1280, 800); await b.go("/producto/" + (await slugOf("Mochila urbana")), 3000); await closePopup(); await b.sleep(400);
        await b.click("Agregar al carrito"); await b.sleep(900);
        await b.shot("front-carrito-drawer");
      });
      await step("checkout", async () => {
        await b.size(1280, 1500); await b.go("/carrito", 3500); await closePopup(); await b.sleep(400);
        await b.shot("front-checkout-a");
      });
      await step("checkout-envio", async () => {
        await b.size(1280, 1500);
        await b.click("Finalizar compra"); await b.sleep(2500);
        await b.setValue("input[placeholder='Ej: 3000']", "3000"); await b.sleep(2500);
        await b.js(`[...document.querySelectorAll('p')].filter(p=>/No pudimos consultar la tarifa/.test(p.innerText)).forEach(p=>p.remove())`);
        await b.shot("front-checkout-b");
      });
      await step("gracias", async () => {
        const o = await one(`select id from "Order" where "paymentMethod"='transferencia' order by "createdAt" desc limit 1`);
        await b.size(1280, 700); await b.go("/carrito/gracias?id=" + o.id, 2500); await b.shot("front-gracias");
      });
    }

    if (wanted("cuenta")) {
      await b.asUser(sofia.id, "customer", sofia.email, sofia.name);
      for (const pr of ["Mochila urbana", "Taza de cerámica esmaltada", "Vela aromática"]) {
        await db.query(`insert into "Favorite"(id,"userId","productId") select 'fav-'||substr(md5(random()::text),1,8), $1, id from "Product" where name=$2 on conflict do nothing`, [sofia.id, pr]);
      }
      await step("pedidos", async () => { await b.size(1200, 1100); await b.go("/mi-cuenta/pedidos", 2500); await closePopup(); await b.shot("front-pedidos"); });
      await step("direcciones", async () => { await b.size(1200, 700); await b.go("/mi-cuenta/direcciones", 2500); await closePopup(); await b.shot("front-direcciones"); });
      await step("favoritos", async () => { await b.size(1200, 900); await b.go("/mi-cuenta/favoritos", 3000); await closePopup(); await b.shot("front-favoritos"); });
      await step("puntos", async () => { await b.size(1200, 1000); await b.go("/mi-cuenta/puntos", 3000); await closePopup(); await b.shot("front-puntos"); });
    }

    if (wanted("extras")) {
      await b.as(null);
      await step("chat", async () => {
        await b.size(1280, 800); await b.go("/", 3000); await closePopup(); await b.sleep(500);
        await b.click("css:button[aria-label^='Abrir V']"); await b.sleep(900);
        await b.shot("front-chat", { clip: { x: 800, y: 0, width: 480, height: 800 } });
      });
      await step("contacto", async () => {
        await b.size(1280, 1100); await b.go("/pagina/contacto", 3000); await closePopup(); await b.sleep(400);
        await b.shot("front-contacto");
      });
      await step("popup", async () => {
        await b.size(1280, 800); await b.go("/", 4000); await b.sleep(1500);
        await b.shot("front-popup");
      });
    }
  } finally { b.close(); await db.end(); }
})();
