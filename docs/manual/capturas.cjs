// Saca las capturas del manual desde la tienda de demostración (ver seed-demo.ts). Uso:
//   node docs/manual/capturas.cjs            todas
//   node docs/manual/capturas.cjs ventas     solo los grupos que contengan "ventas"
// Hace falta la app corriendo (npm run dev) apuntando a la base de la demostración.
require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const open = require("./capturas-lib.cjs");

const only = process.argv.slice(2);
const wanted = (g) => only.length === 0 || only.some((o) => g.includes(o));

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/tienda_db(_e2e)?/, "/tienda_demo_e2e").replace(/\?.*$/, "") });
  await db.connect();
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const pid = async (slug) => (await one(`select id from "Product" where slug=$1`, [slug])).id;
  const b = await open();
  const step = async (name, fn) => { try { await fn(); } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); } };
  const group = async (name, fn) => { if (!wanted(name)) return; console.log(`\n# ${name}`); await fn(); };
  try {
    // ================= EMPEZAR Y CATÁLOGO =================
    await group("catalogo", async () => {
      await b.as("admin");
      await step("inicio", async () => { await b.size(1200, 1300); await b.go("/admin/inicio", 2500); await b.shot("inicio"); });
      await step("campanita", async () => { await b.size(1200, 800); await b.go("/admin/inicio", 1800); await b.click("css:button[aria-label*='novedades']"); await b.sleep(400); await b.shot("campanita", { clip: { x: 224, y: 0, width: 976, height: 330 } }); });
      await step("buscador", async () => { await b.size(1200, 760); await b.go("/admin/inicio", 1500); await b.setValue("input[aria-label='Buscar una sección del panel']", "ped"); await b.sleep(500); await b.shot("buscador-panel", { clip: { x: 0, y: 0, width: 520, height: 420 } }); });
      await step("productos-lista", async () => { await b.size(1200, 1050); await b.go("/admin/productos?per=25", 2000); await b.shot("productos-lista"); });
      await step("productos-filtros", async () => { await b.size(1200, 760); await b.go("/admin/productos?per=25&type=variable&avail=in", 1800); await b.shot("productos-filtros"); });
      await step("productos-masivas", async () => {
        await b.size(1200, 900); await b.go("/admin/productos?per=25", 1800);
        await b.js(`[...document.querySelectorAll('tbody tr')].slice(1,4).forEach(r=>r.querySelector('input[type=checkbox]').click())`); await b.sleep(500);
        await b.shot("productos-masivas", { clip: { x: 224, y: 40, width: 976, height: 520 } });
      });
      const taza = await pid("taza-de-ceramica-esmaltada");
      await step("producto-editar", async () => {
        await b.size(1320, 1000); await b.go("/admin/productos/" + taza, 2400);
        await b.shot("producto-editar-a");
        await b.shot("producto-existencia", { card: "Precio y existencia", pad: 10 });
        await b.shot("producto-imagenes", { card: "Imágenes y videos", pad: 10 });
        await b.shot("producto-lateral", { el: "main aside", pad: 6 });
        await b.shot("producto-categorias", { card: "Categorías", pad: 10 });
        await b.shot("producto-costo-promo", { card: "Costo y promoción", pad: 10 });
      });
      await step("producto-variable", async () => { await b.size(1320, 1100); await b.go("/admin/productos/" + (await pid("remera-basica-de-algodon")), 2400); await b.shot("producto-variable", { card: "Variantes", pad: 10 }); });
      await step("productos-csv", async () => { await b.size(1200, 800); await b.go("/admin/productos/importar", 1500); await b.shot("productos-csv"); });
      await step("categorias", async () => { await b.size(1200, 1000); await b.go("/admin/categorias", 1800); await b.shot("categorias-lista"); });
      await step("categoria-editar", async () => { await b.size(1200, 900); await b.go("/admin/categorias/c-cocina", 1800); await b.shot("categoria-editar"); });
      await step("atributos", async () => { await b.size(1200, 760); await b.go("/admin/atributos", 1500); await b.shot("atributos-lista"); });
      await step("atributo-valores", async () => { await b.size(1200, 900); await b.go("/admin/atributos/a-color", 1800); await b.shot("atributo-valores"); });
      await step("etiquetas", async () => { await b.size(1200, 700); await b.go("/admin/etiquetas", 1500); await b.shot("etiquetas"); });
    });

    // ================= VENTAS =================
    await group("ventas", async () => {
      await b.as("admin");
      await step("ventas-lista", async () => { await b.size(1200, 900); await b.go("/admin/ventas", 700); await b.shot("ventas-lista"); });
      await step("venta-detalle", async () => { await b.size(1200, 1000); await b.go("/admin/ventas", 1500); await b.click("css:tbody tr:nth-child(4)"); await b.sleep(700); await b.shot("venta-detalle"); });
      await step("estadisticas", async () => { await b.size(1200, 1700); await b.go("/admin/estadisticas", 2500); await b.shot("estadisticas"); });
      await step("visitas", async () => { await b.size(1200, 1900); await b.go("/admin/visitas", 2600); await b.js(`const i=document.querySelector('input[aria-label="Link con origen"]');if(i)i.value=i.value.replace(/^https?:\\/\\/[^/]+/,"https://tutienda.com")`); await b.shot("visitas"); });
    });

    // ================= RECUPERAR CLIENTES =================
    await group("clientes-recuperar", async () => {
      await b.as("admin");
      await step("carritos", async () => { await b.size(1200, 1000); await b.go("/admin/carritos-abandonados", 2000); await b.shot("carritos"); });
      await step("carritos-auto", async () => { await b.size(1200, 900); await b.go("/admin/carritos-abandonados", 1800); await b.click("Ajustes"); await b.sleep(400); await b.shot("carritos-auto", { card: "Recuperación automática por mail", pad: 10 }); });
      await step("lista-espera", async () => { await b.size(1200, 760); await b.go("/admin/lista-espera", 1500); await b.shot("lista-espera"); });
      await step("mailing", async () => { await b.size(1200, 1150); await b.go("/admin/mailing", 2200); await b.shot("mailing"); });
      await step("mailing-disp", async () => { await b.size(1200, 900); await b.go("/admin/mailing", 1800); await b.click("Disponibilidad"); await b.sleep(500); await b.shot("mailing-disponibilidad"); });
      await step("notificaciones", async () => { await b.size(1200, 900); await b.go("/admin/notificaciones", 1800); await b.shot("notificaciones"); });
      await step("conversaciones", async () => { await b.size(1200, 800); await b.go("/admin/conversaciones", 1800); await b.shot("conversaciones"); });
      await step("conversacion-detalle", async () => {
        const c = await one(`select id from "AiConversation" where name='Lucía Fernández'`);
        await b.size(1200, 800); await b.go("/admin/conversaciones/" + c.id, 1800); await b.shot("conversacion-detalle");
      });
      await step("mensajes", async () => { await b.size(1200, 700); await b.go("/admin/mensajes", 1500); await b.shot("mensajes"); });
    });

    // ================= REGLAS DE LA TIENDA =================
    await group("reglas", async () => {
      await b.as("admin");
      await step("pagos", async () => { await b.size(1200, 1400); await b.go("/admin/pagos", 2200); await b.shot("pagos"); });
      await step("envios", async () => { await b.size(1200, 1500); await b.go("/admin/envios", 2200); await b.shot("envios-a"); await b.size(1200, 1500); await b.scrollMain(1450); await b.shot("envios-b"); });
      await step("cupones-rapido", async () => { await b.size(1200, 800); await b.go("/admin/cupones", 1800); await b.shot("cupones-rapido"); });
      await step("cupones-lista", async () => { await b.size(1200, 1000); await b.go("/admin/cupones", 1600); await b.click("Cupones activos"); await b.sleep(500); await b.shot("cupones-lista"); });
      await step("cupones-nuevo", async () => { await b.size(1200, 1000); await b.go("/admin/cupones", 1600); await b.click("Nuevo cupón"); await b.sleep(500); await b.shot("cupones-nuevo"); });
      await step("puntos", async () => { await b.size(1200, 1100); await b.go("/admin/puntos", 2000); await b.shot("puntos"); });
    });

    // ================= ASPECTO Y CONTENIDO =================
    await group("aspecto", async () => {
      await b.as("admin");
      await step("temas", async () => { await b.size(1200, 1100); await b.go("/admin/temas", 2000); await b.shot("temas"); });
      await step("tema-editar", async () => {
        const t = await one(`select id from "Theme" where "isBase"=true`);
        await b.size(1200, 1300); await b.go("/admin/temas/" + t.id, 2400); await b.shot("tema-editar");
      });
      await step("paginas", async () => { await b.size(1200, 760); await b.go("/admin/paginas", 1500); await b.shot("paginas"); });
      await step("pagina-editar", async () => {
        const p = await one(`select id from "Page" where slug='quienes-somos'`);
        await b.size(1200, 1000); await b.go("/admin/paginas/" + p.id, 2000); await b.shot("pagina-editar");
      });
      await step("contacto", async () => { await b.size(1200, 900); await b.go("/admin/contacto", 1800); await b.shot("contacto"); });
    });

    // ================= CLIENTES Y EQUIPO =================
    await group("equipo", async () => {
      await b.as("super");
      await step("clientes", async () => { await b.size(1200, 1000); await b.go("/admin/usuarios", 2000); await b.shot("clientes"); });
      await step("cliente-ficha", async () => {
        const u = await one(`select id from "User" where email='sofia.martinez@example.com'`);
        await b.size(1200, 1400); await b.go("/admin/usuarios/" + u.id, 2200); await b.shot("cliente-ficha");
      });
      await step("nuevo-admin", async () => { await b.size(1200, 760); await b.go("/admin/usuarios", 1800); await b.click("+ Nuevo administrador"); await b.sleep(500); await b.shot("nuevo-admin"); });
      await step("reset-password", async () => { await b.size(1200, 800); await b.go("/admin/usuarios", 1800); await b.click("Contraseña"); await b.sleep(500); await b.shot("reset-password"); });
      await step("segmentos", async () => { await b.size(1200, 900); await b.go("/admin/segmentos", 1800); await b.shot("segmentos"); });
      await step("suscriptores", async () => { await b.size(1200, 800); await b.go("/admin/suscriptores", 1500); await b.shot("suscriptores"); });
      await step("registro", async () => { await b.size(1200, 800); await b.go("/admin/logs", 1500); await b.shot("registro"); });
    });
  } finally { b.close(); await db.end(); }
})();
