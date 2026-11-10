// Puebla una base DESCARTABLE con una tienda de demostración ("Tienda Modelo") para sacar las capturas del manual.
// Todo es inventado y neutro: sin marcas, logos ni datos reales. Se corre con el runner de pruebas, que usa su propia base:
//   DATABASE_URL=postgresql://.../tienda_demo node tests/e2e/run.cjs docs/manual/seed-demo.ts
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { storeImage } from "@/lib/storage";
import { ensurePagesSeeded } from "@/lib/pages";
import { ensureSegmentsSeeded } from "@/lib/customers";
import { sanitizeThemeConfig, configFromTemplate, DEFAULT_THEME_CONFIG } from "@/lib/themes";

const DAY = 86400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000);

// ---------- imágenes de ejemplo ----------
type Glyph = "mug" | "shirt" | "bag" | "candle" | "jewel" | "cushion" | "jar" | "hat" | "box" | "pants" | "coat" | "shoe" | "towel";
const PALETTES: Record<string, [string, string, string]> = {
  hogar: ["#f6e7d8", "#e9cdb0", "#8a5a3c"],
  ind: ["#dde8f5", "#bcd0ea", "#2f5d8a"],
  acc: ["#f3dde6", "#e8bfd0", "#8a3a5c"],
  reg: ["#e3f0e0", "#c4dfbe", "#3d6b36"],
};
function glyph(kind: Glyph, c: string): string {
  const f = `fill="${c}"`;
  switch (kind) {
    case "mug": return `<rect x="-90" y="-80" width="150" height="170" rx="22" ${f}/><path d="M60 -45 h25 a40 40 0 0 1 0 80 h-25" fill="none" stroke="${c}" stroke-width="22"/>`;
    case "shirt": return `<path d="M-130 -90 L-60 -125 Q0 -85 60 -125 L130 -90 L100 -20 L65 -35 L65 120 L-65 120 L-65 -35 L-100 -20 Z" ${f}/>`;
    case "pants": return `<path d="M-70 -120 H70 L85 125 H20 L0 -10 L-20 125 H-85 Z" ${f}/>`;
    case "coat": return `<path d="M-120 -100 L-45 -125 L0 -90 L45 -125 L120 -100 L140 110 L60 110 L60 -20 L-60 -20 L-60 110 L-140 110 Z" ${f}/>`;
    case "bag": return `<rect x="-110" y="-30" width="220" height="160" rx="18" ${f}/><path d="M-55 -30 a55 70 0 0 1 110 0" fill="none" stroke="${c}" stroke-width="18"/>`;
    case "candle": return `<rect x="-55" y="-30" width="110" height="150" rx="10" ${f}/><ellipse cx="0" cy="-70" rx="16" ry="34" fill="#f5a623"/>`;
    case "jewel": return `<circle cx="0" cy="10" r="85" fill="none" stroke="${c}" stroke-width="26"/><circle cx="0" cy="-92" r="22" ${f}/>`;
    case "cushion": return `<rect x="-125" y="-95" width="250" height="190" rx="48" ${f}/><path d="M-80 -50 L80 50 M80 -50 L-80 50" stroke="#ffffff55" stroke-width="10"/>`;
    case "jar": return `<rect x="-70" y="-60" width="140" height="170" rx="26" ${f}/><rect x="-80" y="-100" width="160" height="40" rx="10" fill="${c}cc"/>`;
    case "hat": return `<path d="M-110 40 a110 110 0 0 1 220 0 Z" ${f}/><rect x="-125" y="40" width="250" height="34" rx="17" fill="${c}cc"/>`;
    case "shoe": return `<path d="M-130 70 L-130 -10 Q-40 -20 20 -80 L50 -50 Q90 30 140 40 Q150 70 140 80 Z" ${f}/>`;
    case "towel": return `<rect x="-120" y="-100" width="240" height="200" rx="14" ${f}/><rect x="-120" y="-30" width="240" height="26" fill="#ffffff66"/><rect x="-120" y="30" width="240" height="26" fill="#ffffff66"/>`;
    default: return `<rect x="-110" y="-60" width="220" height="160" rx="12" ${f}/><rect x="-14" y="-60" width="28" height="160" fill="#ffffff88"/><rect x="-110" y="0" width="220" height="24" fill="#ffffff88"/>`;
  }
}
async function art(kind: Glyph, theme: keyof typeof PALETTES, label: string): Promise<Buffer> {
  const [c1, c2, ink] = PALETTES[theme];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <circle cx="400" cy="350" r="250" fill="#ffffff" opacity="0.35"/>
    <g transform="translate(400 350) scale(1.25)">${glyph(kind, ink)}</g>
    <text x="400" y="720" font-family="Helvetica, Arial, sans-serif" font-size="40" text-anchor="middle" fill="${ink}" opacity="0.8">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function hero(c1: string, c2: string, shape: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="1600" height="640" fill="url(#g)"/>
    <circle cx="${1250 + shape * 30}" cy="320" r="330" fill="#ffffff" opacity="0.14"/>
    <circle cx="${1450 - shape * 40}" cy="520" r="200" fill="#ffffff" opacity="0.12"/>
    <circle cx="${200 + shape * 50}" cy="110" r="140" fill="#ffffff" opacity="0.10"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function logoPng(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="305" viewBox="0 0 1080 305">
    <rect x="30" y="60" width="185" height="185" rx="36" fill="#b9b2c0"/>
    <text x="122" y="190" font-family="Helvetica, Arial, sans-serif" font-size="120" font-weight="700" text-anchor="middle" fill="#ffffff">T</text>
    <text x="270" y="195" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="700" fill="#8f8898">Tu logo</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function faviconPng(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ffffff"/><rect x="56" y="56" width="400" height="400" rx="90" fill="#b9b2c0"/><text x="256" y="350" font-family="Helvetica, Arial, sans-serif" font-size="280" font-weight="700" text-anchor="middle" fill="#ffffff">T</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  // ---------- limpieza ----------
  for (const t of [
    "orderEvent", "orderItem", "order", "couponRedemption", "coupon", "pointTransaction", "pointReward", "waitlistEntry", "abandonedCart",
    "aiMessage", "aiConversation", "contactMessage", "mailCampaign", "pushCampaign", "pushSubscription", "newsletterSubscriber", "favorite",
    "address", "adminLog", "pageView", "searchQuery", "funnelEvent", "monthlyUsage", "contactCard", "zipCodeDiscount", "zipCodeRestriction",
    "paymentMethodShipping", "paymentMethodCategoryDiscount", "paymentMethodConfig", "shippingMethod", "theme", "productTag", "productRelation",
    "variantAttributeTerm", "variant", "productAttribute", "productCategory", "productImage", "product", "tag", "attributeTerm", "attribute", "category",
  ] as const) await (prisma[t] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  await prisma.user.deleteMany({ where: { role: "customer" } });

  // ---------- imágenes de marca ----------
  const logo = await storeImage(await logoPng());
  const favicon = await storeImage(await faviconPng());

  // ---------- configuración ----------
  await prisma.storeSettings.deleteMany();
  await prisma.storeSettings.create({
    data: {
      id: "global",
      franchiseName: "Tienda Modelo",
      franchiseLocation: "Tu ciudad",
      instagramHandle: "tutienda",
      whatsappPhone: "5491100000000",
      address: "Av. Principal 1234, Tu ciudad",
      contactEmail: "hola@tutienda.com",
      footerText: "Tu tienda online de confianza: envíos a todo el país, pagos seguros y atención personalizada.",
      logoHeaderUrl: logo.url,
      logoFooterUrl: logo.url,
      faviconUrl: favicon.url,
      currency: "ARS",
      pointsEnabled: true,
      pointsRatio: 0.01,
      hideOutOfStock: false,
      cartAutoCloseSeconds: 2,
      homeFeaturedTitle: "Productos destacados",
      homeOffersTitle: "Ofertas y promociones",
      marqueeText: "Envíos a todo el país\nCuotas sin interés\nRetiro gratis en el local",
      homeBenefits: [
        { icon: "truck", title: "Envíos a todo el país", subtitle: "Por correo o cadetería" },
        { icon: "credit-card", title: "Pagá como quieras", subtitle: "Tarjeta, transferencia o efectivo" },
        { icon: "store", title: "Retiro en el local", subtitle: "Sin costo, en el día" },
        { icon: "gift", title: "Regalos listos", subtitle: "Con caja y tarjeta" },
      ],
      popupEnabled: true,
      popupTitle: "¡10% en tu primera compra!",
      popupBodyHtml: "<p>Usá el código <strong>BIENVENIDA10</strong> al finalizar tu compra.</p>",
      popupScope: "home",
      popupFrequency: "once",
      // vendedora virtual
      aiAssistantEnabled: true,
      aiProvider: "openai",
      aiApiKey: "sk-demo-no-real",
      aiAssistantName: "Vendedora virtual",
      aiWelcomeMessage: "¡Hola! Contame qué estás buscando y te ayudo a encontrarlo.",
      aiInstructions: "Priorizá las novedades de la temporada.\nPreguntá para qué ocasión busca el producto.\nMantené un tono cercano y breve.",
      // correo
      mailProvider: "smtp",
      smtpHost: "smtp.tuproveedor.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "ventas@tutienda.com",
      smtpPassword: "demo-password",
      mailFromName: "Tienda Modelo",
      mailFromEmail: "ventas@tutienda.com",
      mailMonthlyQuota: 2000,
      aiMonthlyTokenQuota: 500000,
      telegramBotToken: "123456:DEMO-TOKEN",
      telegramChatId: "-1001234567890",
      checkoutNotice: "Los pedidos hechos después de las 18 h se preparan al día siguiente.",
      // envíos
      freeShippingEnabled: true,
      freeShippingThreshold: 60000,
      acordarEnabled: true,
      cadeteEnabled: false,
      zipRestrictionsEnabled: true,
      zipDiscountsEnabled: true,
      shippingDefaultWeightKg: 0.5,
      ocaEnabled: true,
      ocaCuit: "30-00000000-0",
      ocaOperativa: "1234567",
      ocaOperativaSucursal: "7654321",
      ocaOriginZipCode: "1000",
      ocaOriginStreet: "Av. Principal",
      ocaOriginNumber: "1234",
      ocaOriginCity: "Tu ciudad",
      ocaOriginProvince: "Buenos Aires",
      ocaOriginContact: "Depósito Tienda Modelo",
      ocaOriginEmail: "envios@tutienda.com",
      ocaFranjaHoraria: "1",
      ocaUser: "usuario-oca",
      ocaPassword: "demo",
      ocaNroCliente: "0000000",
      ocaBranchDiscountPct: 10,
      cartRecoveryEnabled: true,
      cartRecoveryDelayHours: 4,
    },
  });

  // ---------- categorías ----------
  type Cat = { id: string; name: string; slug: string; parent?: string; theme: keyof typeof PALETTES; glyph: Glyph };
  const cats: Cat[] = [
    { id: "c-hogar", name: "Hogar y deco", slug: "hogar-y-deco", theme: "hogar", glyph: "cushion" },
    { id: "c-living", name: "Living", slug: "living", parent: "c-hogar", theme: "hogar", glyph: "cushion" },
    { id: "c-cocina", name: "Cocina", slug: "cocina", parent: "c-hogar", theme: "hogar", glyph: "mug" },
    { id: "c-bano", name: "Baño", slug: "bano", parent: "c-hogar", theme: "hogar", glyph: "towel" },
    { id: "c-ind", name: "Indumentaria", slug: "indumentaria", theme: "ind", glyph: "shirt" },
    { id: "c-remeras", name: "Remeras", slug: "remeras", parent: "c-ind", theme: "ind", glyph: "shirt" },
    { id: "c-pantalones", name: "Pantalones", slug: "pantalones", parent: "c-ind", theme: "ind", glyph: "pants" },
    { id: "c-abrigos", name: "Abrigos", slug: "abrigos", parent: "c-ind", theme: "ind", glyph: "coat" },
    { id: "c-calzado", name: "Calzado", slug: "calzado", parent: "c-ind", theme: "ind", glyph: "shoe" },
    { id: "c-acc", name: "Accesorios", slug: "accesorios", theme: "acc", glyph: "bag" },
    { id: "c-bolsos", name: "Bolsos y mochilas", slug: "bolsos-y-mochilas", parent: "c-acc", theme: "acc", glyph: "bag" },
    { id: "c-bijou", name: "Bijouterie", slug: "bijouterie", parent: "c-acc", theme: "acc", glyph: "jewel" },
    { id: "c-reg", name: "Regalos", slug: "regalos", theme: "reg", glyph: "box" },
    { id: "c-ella", name: "Para ella", slug: "para-ella", parent: "c-reg", theme: "reg", glyph: "candle" },
    { id: "c-el", name: "Para él", slug: "para-el", parent: "c-reg", theme: "reg", glyph: "box" },
  ];
  for (const [i, c] of cats.entries()) {
    const img = !c.parent ? await storeImage(await art(c.glyph, c.theme, c.name)) : null;
    await prisma.category.create({
      data: { id: c.id, name: c.name, slug: c.slug, parentId: c.parent ?? null, sortOrder: i, imageUrl: img?.url ?? null, description: !c.parent ? `Todo lo de ${c.name.toLowerCase()}.` : null },
    });
  }
  const catById = new Map(cats.map((c) => [c.id, c]));

  // ---------- atributos ----------
  const talle = await prisma.attribute.create({ data: { id: "a-talle", name: "Talle", slug: "talle", sortOrder: 0 } });
  const color = await prisma.attribute.create({ data: { id: "a-color", name: "Color", slug: "color", sortOrder: 1 } });
  await prisma.attribute.create({ data: { id: "a-material", name: "Material", slug: "material", sortOrder: 2 } });
  const T: Record<string, string> = {};
  for (const [i, n] of ["S", "M", "L", "XL"].entries()) T[n] = (await prisma.attributeTerm.create({ data: { attributeId: talle.id, name: n, slug: n.toLowerCase(), sortOrder: i } })).id;
  const C: Record<string, string> = {};
  for (const [i, [n, hex]] of ([["Blanco", "#f5f5f5"], ["Negro", "#212121"], ["Rojo", "#e53935"], ["Azul", "#1e88e5"], ["Gris", "#9e9e9e"]] as const).entries()) {
    C[n] = (await prisma.attributeTerm.create({ data: { attributeId: color.id, name: n, slug: n.toLowerCase(), colorHex: hex, sortOrder: i } })).id;
  }
  for (const [i, n] of ["Algodón", "Lino", "Cerámica", "Cuero", "Madera"].entries()) await prisma.attributeTerm.create({ data: { attributeId: "a-material", name: n, slug: n.toLowerCase(), sortOrder: i } });

  // ---------- etiquetas ----------
  const tags: Record<string, string> = {};
  for (const [i, n] of ["Nuevo", "Oferta", "Regalo"].entries()) tags[n] = (await prisma.tag.create({ data: { name: n, slug: n.toLowerCase(), sortOrder: i } })).id;

  // ---------- productos ----------
  type P = {
    name: string; cat: string; price: number; glyph: Glyph; mode: "available" | "unavailable" | number; featured?: boolean; promo?: number; draft?: boolean;
    tags?: string[]; scheduled?: boolean; cost?: number; variants?: { talles: string[]; colores?: string[]; off?: string[] };
  };
  const products: P[] = [
    { name: "Taza de cerámica esmaltada", cat: "c-cocina", price: 4500, glyph: "mug", mode: "available", tags: ["Nuevo"], cost: 2100 },
    { name: "Set de 4 posavasos", cat: "c-cocina", price: 6200, glyph: "box", mode: 24 },
    { name: "Frasco de vidrio con tapa", cat: "c-cocina", price: 3800, glyph: "jar", mode: 3 },
    { name: "Almohadón de lino", cat: "c-living", price: 9800, glyph: "cushion", mode: "available", promo: 7900, tags: ["Oferta"], featured: true },
    { name: "Manta tejida", cat: "c-living", price: 18500, glyph: "cushion", mode: "unavailable" },
    { name: "Vela aromática", cat: "c-ella", price: 5600, glyph: "candle", mode: 40, featured: true, tags: ["Regalo"] },
    { name: "Difusor de ambientes", cat: "c-living", price: 8900, glyph: "jar", mode: "available" },
    { name: "Toalla de algodón", cat: "c-bano", price: 7400, glyph: "towel", mode: "available" },
    { name: "Jabonera de madera", cat: "c-bano", price: 3200, glyph: "box", mode: 15 },
    { name: "Mochila urbana", cat: "c-bolsos", price: 28900, glyph: "bag", mode: 8, featured: true, tags: ["Nuevo"] },
    { name: "Riñonera de cuero", cat: "c-bolsos", price: 21500, glyph: "bag", mode: "available" },
    { name: "Cartera mini", cat: "c-bolsos", price: 19800, glyph: "bag", mode: "available", promo: 15900, tags: ["Oferta"] },
    { name: "Aros dorados", cat: "c-bijou", price: 3500, glyph: "jewel", mode: 60 },
    { name: "Collar con dije", cat: "c-bijou", price: 5900, glyph: "jewel", mode: "available", featured: true },
    { name: "Pulsera trenzada", cat: "c-bijou", price: 2400, glyph: "jewel", mode: "unavailable" },
    { name: "Gorro de lana", cat: "c-abrigos", price: 6900, glyph: "hat", mode: "available" },
    { name: "Bufanda tejida", cat: "c-abrigos", price: 8200, glyph: "towel", mode: 12 },
    { name: "Llavero de cuero", cat: "c-el", price: 2800, glyph: "box", mode: 100, tags: ["Regalo"] },
    { name: "Billetera clásica", cat: "c-el", price: 14500, glyph: "bag", mode: "available", tags: ["Regalo"] },
    { name: "Caja de regalo", cat: "c-reg", price: 4900, glyph: "box", mode: "available", draft: true },
    { name: "Remera básica de algodón", cat: "c-remeras", price: 8900, glyph: "shirt", mode: "available", featured: true, variants: { talles: ["S", "M", "L"], colores: ["Blanco", "Negro"], off: ["S|Negro"] } },
    { name: "Remera estampada", cat: "c-remeras", price: 10500, glyph: "shirt", mode: "available", variants: { talles: ["S", "M", "L", "XL"], colores: ["Negro", "Rojo"] }, tags: ["Nuevo"] },
    { name: "Pantalón recto", cat: "c-pantalones", price: 24900, glyph: "pants", mode: "available", variants: { talles: ["S", "M", "L", "XL"] } },
    { name: "Jean clásico", cat: "c-pantalones", price: 29900, glyph: "pants", mode: "available", promo: 24900, variants: { talles: ["S", "M", "L"], colores: ["Azul", "Negro"] }, tags: ["Oferta"] },
    { name: "Campera liviana", cat: "c-abrigos", price: 38900, glyph: "coat", mode: "available", featured: true, variants: { talles: ["S", "M", "L"], colores: ["Azul", "Negro"], off: ["L|Azul", "L|Negro"] } },
    { name: "Buzo con capucha", cat: "c-abrigos", price: 27500, glyph: "coat", mode: "available", variants: { talles: ["S", "M", "L", "XL"], colores: ["Gris", "Negro"] } },
    { name: "Zapatillas urbanas", cat: "c-calzado", price: 45900, glyph: "shoe", mode: "available", variants: { talles: ["S", "M", "L"], colores: ["Blanco", "Negro"] }, tags: ["Nuevo"] },
    { name: "Colección invierno (próximamente)", cat: "c-abrigos", price: 52000, glyph: "coat", mode: "available", scheduled: true },
  ];
  const productIds: string[] = [];
  for (const [i, p] of products.entries()) {
    const c = catById.get(p.cat)!;
    const img = await storeImage(await art(p.glyph, c.theme, p.name.length > 26 ? p.name.slice(0, 24) + "…" : p.name));
    const isVar = Boolean(p.variants);
    const manage = typeof p.mode === "number" || p.mode === "unavailable";
    const stock = typeof p.mode === "number" ? p.mode : 0;
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        sku: `TM-${String(i + 1).padStart(3, "0")}`,
        type: isVar ? "variable" : "simple",
        status: p.draft ? "draft" : "published",
        price: p.price,
        promoPrice: p.promo ?? null,
        costPrice: p.cost ?? Math.round(p.price * 0.45),
        stock: isVar ? 0 : stock,
        manageStock: isVar ? false : manage,
        featured: Boolean(p.featured),
        shortDescription: `<p>${p.name}: calidad y diseño pensados para el día a día.</p>`,
        description: `<h3>${p.name}</h3><p>Descripción de ejemplo del producto. Contá acá los materiales, las medidas y los cuidados.</p><ul><li>Material de primera calidad</li><li>Envíos a todo el país</li><li>Cambios dentro de los 30 días</li></ul>`,
        weight: 0.4, width: 20, height: 12, length: 25,
        publishAt: p.scheduled ? new Date(Date.now() + 20 * DAY) : null,
        images: { create: { url: img.url, thumbUrl: img.thumbUrl, sortOrder: 0, alt: p.name } },
        categories: { create: { categoryId: p.cat } },
        ...(p.tags?.length ? { tags: { create: p.tags.map((t) => ({ tagId: tags[t] })) } } : {}),
        ...(isVar ? { attributes: { create: [{ attributeId: talle.id, sortOrder: 0 }, ...(p.variants!.colores ? [{ attributeId: color.id, sortOrder: 1 }] : [])] } } : {}),
      },
    });
    productIds.push(created.id);
    if (isVar) {
      const v = p.variants!;
      const combos = v.talles.flatMap((t) => (v.colores ?? [null]).map((c) => [t, c] as const));
      for (const [t, c] of combos) {
        const off = v.off?.includes(`${t}|${c}`) || v.off?.includes(`${t}`);
        await prisma.variant.create({
          data: {
            productId: created.id, sku: `${created.sku}-${t}${c ? "-" + c.slice(0, 3).toUpperCase() : ""}`, price: p.price, promoPrice: p.promo ?? null,
            stock: off ? 0 : (c ? 6 : 9), manageStock: Boolean(off) || Math.random() > 0.5 ? true : false, enabled: true,
            terms: { create: [{ termId: T[t] }, ...(c ? [{ termId: C[c] }] : [])] },
          },
        });
      }
      // las que "no hay existencia" quedan controladas con 0; las otras alternan entre sin control y con cantidad
    }
  }
  // productos recomendados de ejemplo
  await prisma.productRelation.createMany({ data: [{ productId: productIds[0], relatedId: productIds[1], sortOrder: 0 }, { productId: productIds[0], relatedId: productIds[5], sortOrder: 1 }] });

  // ---------- clientes ----------
  const names: [string, string][] = [
    ["Lucía Fernández", "lucia.fernandez"], ["Martín Gómez", "martin.gomez"], ["Camila Rodríguez", "camila.rodriguez"], ["Joaquín Pérez", "joaquin.perez"],
    ["Valentina López", "valentina.lopez"], ["Mateo Díaz", "mateo.diaz"], ["Sofía Martínez", "sofia.martinez"], ["Tomás Romero", "tomas.romero"],
    ["Julieta Sosa", "julieta.sosa"], ["Nicolás Álvarez", "nicolas.alvarez"], ["Agustina Torres", "agustina.torres"], ["Federico Ruiz", "federico.ruiz"],
    ["Milagros Acosta", "milagros.acosta"], ["Bruno Castro", "bruno.castro"],
  ];
  const users: { id: string; name: string; email: string; phone: string }[] = [];
  for (const [i, [name, local]] of names.entries()) {
    const u = await prisma.user.create({ data: { name, email: `${local}@example.com`, phone: `54911${String(40000000 + i * 137).padStart(8, "0")}`, role: "customer", points: [0, 120, 340, 0, 85, 0, 560, 40, 0, 210, 0, 0, 95, 0][i], createdAt: ago(60 - i * 3) } });
    users.push({ id: u.id, name, email: u.email, phone: u.phone! });
  }
  // el administrador y el superadministrador de la demo
  await prisma.user.deleteMany({ where: { role: "admin" } });
  await prisma.user.update({ where: { id: "superadmin-facundo" }, data: { name: "Superadministrador", email: "super@tutienda.com" } });
  await prisma.user.create({ data: { id: "admin-demo", name: "Administrador", email: "admin@tutienda.com", role: "admin", createdAt: ago(90) } });

  // ---------- medios de pago y envíos ----------
  const pm = (method: string, data: object) => prisma.paymentMethodConfig.create({ data: { method: method as never, ...data } });
  await pm("transferencia", { enabled: true, discountPct: 10, bankCbu: "0000003100000000000001", bankAlias: "tienda.modelo", bankHolderName: "Tienda Modelo S.R.L." });
  await pm("mercadopago", { enabled: true, mpAccessToken: "APP_USR-demo", mpPublicKey: "APP_USR-demo-public", mpWebhookSecret: "demo-secret" });
  await pm("contra_entrega", { enabled: true, discountPct: 0 });
  await pm("payway", { enabled: false });
  await pm("sin_pago", { enabled: false, noPaymentWhatsapp: true, noPaymentEmail: true, noPaymentInstructions: "Te escribimos por WhatsApp para coordinar el pago y la entrega." });
  const retiro = await prisma.shippingMethod.create({ data: { name: "Retiro en el local", description: "Gratis, de lunes a sábados de 10 a 19 h", cost: 0, requiresAddress: false } });
  const cadete = await prisma.shippingMethod.create({ data: { name: "Cadetería (zona centro)", description: "Entrega en el día", cost: 1800 } });
  await prisma.zipCodeRestriction.create({ data: { zipCode: "9999", type: "block_shipping", message: "A esta zona no llegamos por correo: coordiná tu entrega por WhatsApp." } });
  await prisma.zipCodeDiscount.create({ data: { zipCode: "1000", discountType: "percentage", discountValue: 15, label: "Descuento vecinos" } });
  await prisma.contactCard.createMany({
    data: [
      { title: "Local central", address: "Av. Principal 1234, Tu ciudad", phone: "+54 11 0000-0000", whatsapp: "5491100000000", instagram: "tutienda", position: 0 },
      { title: "Sucursal norte", address: "Calle Norte 567, Tu ciudad", phone: "+54 11 0000-1111", whatsapp: "5491100001111", instagram: "tutienda.norte", position: 1 },
    ],
  });

  // ---------- pedidos ----------
  const prods = await prisma.product.findMany({ where: { type: "simple", status: "published" }, select: { id: true, name: true, price: true, sku: true } });
  type O = { u: number; days: number; status: "pending" | "confirmed" | "delivered" | "cancelled"; pay: "transferencia" | "mercadopago" | "contra_entrega" | "sin_pago" | "payway"; ship: "retiro" | "cadete" | "oca" | "acordar"; seen: boolean; items: number[]; coupon?: string; track?: boolean };
  const orders: O[] = [
    { u: 0, days: 0.05, status: "pending", pay: "transferencia", ship: "cadete", seen: false, items: [0, 5] },
    { u: 1, days: 0.2, status: "confirmed", pay: "mercadopago", ship: "oca", seen: false, items: [9] },
    { u: 2, days: 0.4, status: "pending", pay: "contra_entrega", ship: "retiro", seen: false, items: [3, 7, 12] },
    { u: 3, days: 1.5, status: "confirmed", pay: "mercadopago", ship: "oca", seen: true, items: [10, 13], track: true },
    { u: 4, days: 2.1, status: "delivered", pay: "transferencia", ship: "cadete", seen: true, items: [5, 6] },
    { u: 5, days: 3.4, status: "delivered", pay: "mercadopago", ship: "oca", seen: true, items: [11], coupon: "BIENVENIDA10" },
    { u: 6, days: 5, status: "delivered", pay: "transferencia", ship: "retiro", seen: true, items: [0, 1, 2] },
    { u: 7, days: 6.2, status: "cancelled", pay: "mercadopago", ship: "oca", seen: true, items: [9] },
    { u: 8, days: 8, status: "delivered", pay: "contra_entrega", ship: "cadete", seen: true, items: [14, 15] },
    { u: 9, days: 10, status: "delivered", pay: "mercadopago", ship: "oca", seen: true, items: [10, 12, 13] },
    { u: 10, days: 12, status: "delivered", pay: "transferencia", ship: "retiro", seen: true, items: [16] },
    { u: 11, days: 15, status: "delivered", pay: "sin_pago", ship: "acordar", seen: true, items: [4, 8] },
    { u: 12, days: 18, status: "delivered", pay: "mercadopago", ship: "oca", seen: true, items: [3] },
    { u: 0, days: 22, status: "delivered", pay: "transferencia", ship: "cadete", seen: true, items: [5] },
    { u: 1, days: 27, status: "delivered", pay: "mercadopago", ship: "oca", seen: true, items: [9, 13] },
    { u: 6, days: 33, status: "delivered", pay: "transferencia", ship: "retiro", seen: true, items: [0, 6] },
    { u: 2, days: 38, status: "delivered", pay: "mercadopago", ship: "oca", seen: true, items: [10] },
    { u: 4, days: 43, status: "delivered", pay: "contra_entrega", ship: "cadete", seen: true, items: [11, 12] },
  ];
  const quickCoupon = await prisma.coupon.create({ data: { code: "BIENVENIDA10", discountType: "percentage", discountValue: 10, enabled: true, maxUses: 200, usedCount: 1, oneUsePerCustomer: true } });
  for (const [idx, o] of orders.entries()) {
    const u = users[o.u];
    const lines = o.items.map((pi) => prods[pi % prods.length]);
    const subtotal = lines.reduce((s, l) => s + l.price, 0);
    const shipCost = o.ship === "cadete" ? 1800 : o.ship === "oca" ? 3400 : 0;
    const couponDiscount = o.coupon ? Math.round(subtotal * 0.1) : 0;
    const payDiscount = o.pay === "transferencia" ? Math.round(subtotal * 0.1) : 0;
    const total = subtotal - couponDiscount - payDiscount + shipCost;
    const order = await prisma.order.create({
      data: {
        userId: u.id, customerName: u.name, customerEmail: u.email, customerPhone: u.phone, subtotal, total, status: o.status, paymentMethod: o.pay,
        shippingMethodId: o.ship === "retiro" ? retiro.id : o.ship === "cadete" ? cadete.id : null,
        shippingCost: shipCost, shippingAddress: o.ship === "retiro" || o.ship === "acordar" ? null : `Calle Ejemplo ${100 + idx * 7}, Tu ciudad (CP 1000)`,
        shippingCode: o.ship === "oca" ? "oca_domicilio" : null, shippingName: o.ship === "oca" ? "OCA a domicilio" : o.ship === "acordar" ? "Envío a acordar" : null,
        couponId: o.coupon ? quickCoupon.id : null, couponDiscount, adminSeenAt: o.seen ? ago(o.days - 0.01 > 0 ? o.days - 0.01 : 0) : null,
        stockDeductedAt: o.status === "cancelled" ? null : ago(o.days),
        trackingNumber: o.track ? "TRK-DEMO-000123" : null, trackingCarrier: o.track ? "OCA" : null, ocaRegisteredAt: o.track ? ago(o.days - 0.1) : null,
        createdAt: ago(o.days), updatedAt: ago(Math.max(0, o.days - 0.05)),
        items: { create: lines.map((l) => ({ productId: l.id, name: l.name, price: l.price, quantity: 1, sku: l.sku })) },
        events: { create: [
          { type: "system", message: "Pedido creado desde la tienda", actor: "Cliente", createdAt: ago(o.days) },
          ...(o.status !== "pending" ? [{ type: "status", message: o.status === "cancelled" ? "Pasó a Cancelado" : "Pago confirmado", actor: "Administrador", createdAt: ago(Math.max(0, o.days - 0.04)) }] : []),
          ...(o.status === "delivered" ? [{ type: "status", message: "Pasó a Entregado", actor: "Administrador", createdAt: ago(Math.max(0, o.days - 0.5)) }] : []),
        ] },
      },
    });
    if (o.status === "delivered") await prisma.pointTransaction.create({ data: { userId: u.id, orderId: order.id, amount: Math.round(subtotal / 1000), description: `Puntos por tu pedido #${order.number}`, createdAt: ago(o.days - 0.4) } });
  }

  // ---------- cupones, puntos ----------
  await prisma.coupon.createMany({
    data: [
      { code: "ENVIOGRATIS", discountType: "free_shipping", discountValue: 0, enabled: true, minPurchaseAmount: 40000, maxUses: 100, usedCount: 12 },
      { code: "VERANO15", discountType: "percentage", discountValue: 15, enabled: true, startsAt: ago(5), expiresAt: new Date(Date.now() + 25 * DAY), usedCount: 7 },
      { code: "BLACK20", discountType: "percentage", discountValue: 20, enabled: true, expiresAt: ago(10), usedCount: 31 },
      { code: "PROMO-OFF", discountType: "fixed", discountValue: 3000, enabled: false, usedCount: 0 },
      { code: "TIENDA-K8P2QX", discountType: "percentage", discountValue: 15, enabled: true, maxUses: 1, usedCount: 0, expiresAt: new Date(Date.now() + 20 * DAY) },
      { code: "TIENDA-M4W9ZB", discountType: "percentage", discountValue: 15, enabled: true, maxUses: 1, usedCount: 1, expiresAt: new Date(Date.now() + 10 * DAY) },
      { code: "CANJE-7HQ3LD", discountType: "percentage", discountValue: 10, enabled: true, maxUses: 1, usedCount: 0, userId: users[6].id },
    ],
  });
  for (const [t, pts, v] of [["10% de descuento", 100, 10], ["$3.000 de descuento", 250, 3000], ["20% de descuento", 500, 20]] as const) {
    await prisma.pointReward.create({ data: { title: t, pointsRequired: pts, discountType: t.startsWith("$") ? "fixed" : "percentage", discountValue: v } });
  }

  // Una clienta con historia: dirección guardada y movimientos de puntos (para las capturas de "Mi cuenta")
  await prisma.address.create({ data: { userId: users[6].id, street: "Av. Principal", number: "1234", apartment: "3B", city: "Tu ciudad", province: "Buenos Aires", zipCode: "3000", phone: users[6].phone ?? undefined, isDefault: true } });
  await prisma.pointTransaction.createMany({ data: [
    { userId: users[6].id, amount: 251, description: "Puntos ganados por pedido entregado", createdAt: ago(34) },
    { userId: users[6].id, amount: 309, description: "Puntos ganados por pedido entregado", createdAt: ago(9) },
  ] });

  // ---------- recuperar clientes ----------
  const items = (idx: number[]) => idx.map((i) => ({ productId: prods[i % prods.length].id, variantId: null, name: prods[i % prods.length].name, price: prods[i % prods.length].price, quantity: 1 }));
  const carts = [
    { u: 0, e: null, idx: [9, 10], h: 3, sent: false }, { u: 3, e: null, idx: [3], h: 9, sent: true }, { u: null, e: "visitante1@example.com", idx: [0, 5, 7], h: 26, sent: true },
    { u: null, e: "visitante2@example.com", idx: [13], h: 52, sent: false }, { u: null, e: null, idx: [11, 12], h: 70, sent: false }, { u: 8, e: null, idx: [14], h: 5, sent: false },
  ];
  for (const [i, c] of carts.entries()) {
    const its = items(c.idx);
    await prisma.abandonedCart.create({ data: { sessionId: `demo-session-${i}`, userId: c.u !== null ? users[c.u].id : null, email: c.e, name: c.u !== null ? users[c.u].name : null, phone: c.u !== null ? users[c.u].phone : null, items: its, total: its.reduce((s, x) => s + x.price, 0), lastActive: ago(0, c.h), createdAt: ago(0, c.h + 1), recoveryEmailSentAt: c.sent ? ago(0, c.h - 4) : null } });
  }
  for (const [i, [pi, n]] of ([[4, "Sofía M."], [14, "Julieta S."], [4, "Bruno C."], [14, "Agustina T."], [4, "Milagros A."]] as const).entries()) {
    await prisma.waitlistEntry.create({ data: { productId: productIds[pi], productName: products[pi].name, categoryName: catById.get(products[pi].cat)!.name, name: n, phone: i % 2 ? null : `54911${50000000 + i * 91}`, email: `espera${i}@example.com`, createdAt: ago(i * 1.5) } });
  }
  for (let i = 0; i < 14; i++) await prisma.newsletterSubscriber.create({ data: { email: `suscriptor${i + 1}@example.com`, createdAt: ago(i * 2) } });
  await prisma.contactMessage.createMany({
    data: [
      { name: "Paula Ríos", email: "paula.rios@example.com", phone: "5491155550001", message: "Hola, ¿hacen envíos a Mendoza? ¿Cuánto tardan?", read: false, createdAt: ago(0, 5) },
      { name: "Diego Luna", email: "diego.luna@example.com", message: "Quiero cambiar el talle de mi pedido, ¿cómo hago?", read: false, createdAt: ago(1) },
      { name: "Carla Vega", email: "carla.vega@example.com", message: "Gracias por la atención, llegó todo perfecto.", read: true, createdAt: ago(6) },
    ],
  });
  await prisma.mailCampaign.createMany({
    data: [
      { subject: "Nueva colección de otoño", title: "Ya llegó lo nuevo", body: "<p>Mirá las novedades de la temporada.</p>", audiences: ["subscribers", "users"], recipientCount: 28, sentCount: 28, status: "done", createdAt: ago(9), finishedAt: ago(9) },
      { subject: "Te extrañamos: 15% para volver", title: "Un regalo para vos", body: "<p>Usá VERANO15.</p>", audiences: ["users"], recipientCount: 14, sentCount: 14, status: "done", createdAt: ago(3), finishedAt: ago(3) },
    ],
  });
  await prisma.pushCampaign.createMany({ data: [{ title: "Volvió el stock ✨", body: "Lo que esperabas ya está disponible.", url: "/tienda", recipientCount: 9, sentCount: 9, status: "done", createdAt: ago(4), finishedAt: ago(4) }] });
  for (let i = 0; i < 9; i++) await prisma.pushSubscription.create({ data: { endpoint: `https://push.example.com/demo/${i}`, p256dh: "demo", auth: "demo", userId: i < 4 ? users[i].id : null } });

  // conversaciones con la vendedora virtual
  const convs: [string | null, string | null, boolean, [string, string][]][] = [
    ["Lucía Fernández", "5491122223333", false, [["user", "Hola, busco una mochila para el trabajo"], ["assistant", "¡Hola Lucía! Tengo la Mochila urbana, ideal para el día a día. ¿Querés que te muestre más opciones?"], ["user", "Sí, ¿tienen en negro?"]]],
    ["Martín Gómez", "5491144445555", true, [["user", "¿Hacen envíos a Córdoba?"], ["assistant", "Sí, enviamos a todo el país por OCA. Pasame tu código postal y te calculo el costo."]]],
    [null, null, false, [["user", "¿Qué medios de pago aceptan?"], ["assistant", "Tarjeta, Mercado Pago, transferencia (con 10% de descuento) y efectivo al retirar."]]],
    ["Camila Rodríguez", "5491166667777", false, [["user", "Necesito hablar con alguien por un cambio de talle"], ["assistant", "Claro, te dejo el contacto de una persona del equipo para ayudarte con eso."]]],
  ];
  for (const [i, [name, phone, handled, msgs]] of convs.entries()) {
    await prisma.aiConversation.create({
      data: {
        sessionId: `00000000-0000-4000-8000-00000000000${i + 1}`, name, phone, handledAt: handled ? ago(0.5) : null, lastMessageAt: ago(i * 0.7, i), createdAt: ago(i * 0.7 + 0.1),
        messages: { create: msgs.map(([role, content], k) => ({ role: role as "user" | "assistant", content, createdAt: ago(i * 0.7, i - k * 0.01) })) },
      },
    });
  }

  // ---------- estadísticas ----------
  for (let d = 0; d < 30; d++) {
    const visits = 12 + Math.round(Math.abs(Math.sin(d / 3)) * 30) + (d < 7 ? 15 : 0);
    // De dónde llega cada visitante (la primera vista de su sesión): mezcla creíble de redes, buscadores, anuncios y directo
    const origins: { channel: string; paid?: boolean; campaign?: string; host?: string }[] = [
      { channel: "instagram" }, { channel: "instagram", campaign: "bio-perfil" }, { channel: "directo" }, { channel: "google" }, { channel: "instagram", paid: true, campaign: "ofertas-de-primavera" },
      { channel: "facebook" }, { channel: "whatsapp", campaign: "recuperar-carrito" }, { channel: "directo" }, { channel: "google" }, { channel: "email", campaign: "newsletter-octubre" },
      { channel: "facebook", paid: true, campaign: "ofertas-de-primavera" }, { channel: "sitio", host: "blogdecasa.com" }, { channel: "tiktok" }, { channel: "instagram" },
    ];
    for (let k = 0; k < visits; k++) {
      const sid = `v-${d}-${k % 14}`;
      const first = k < 14;
      const o = origins[(k + d) % origins.length];
      await prisma.pageView.create({ data: { ...(first ? { isLanding: true, channel: o.channel, paid: o.paid ?? false, campaign: o.campaign ?? null, referrerHost: o.host ?? null } : {}), path: ["/", "/tienda", "/tienda", "/producto/remera-basica-de-algodon", "/carrito"][k % 5], sessionId: sid, createdAt: ago(d, k % 20) } });
    }
    for (let k = 0; k < Math.round(visits / 3); k++) await prisma.funnelEvent.createMany({ data: [{ sessionId: `f-${d}-${k}`, type: "visit", createdAt: ago(d) }, ...(k % 3 === 0 ? [{ sessionId: `f-${d}-${k}`, type: "cart", createdAt: ago(d) }] : [])], skipDuplicates: true });
  }
  for (const [t, n] of [["remera", 24], ["mochila", 17], ["vela", 12], ["zapatillas", 9], ["pantalon", 8], ["taza", 5], ["campera azul", 0], ["bufanda lana", 0]] as const) {
    for (let k = 0; k < Math.max(1, Math.round(n / 2)); k++) await prisma.searchQuery.create({ data: { term: t, resultsCount: n, createdAt: ago(k) } });
  }

  // ---------- consumo, temas, páginas, registro ----------
  const month = (() => { const d = new Date(Date.now() - 3 * 3600_000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();
  await prisma.monthlyUsage.createMany({ data: [{ month, kind: "mail", amount: 1640 }, { month, kind: "ai_tokens", amount: 312000 }, { month, kind: "ai_requests", amount: 96 }] });
  const h1 = await storeImage(await hero("#c9d6ee", "#8fa7d4", 0));
  const h2 = await storeImage(await hero("#f1d9c5", "#e6b48f", 1));
  const b1 = await storeImage(await art("shirt", "ind", "Indumentaria"));
  const b2 = await storeImage(await art("cushion", "hogar", "Hogar"));
  const b3 = await storeImage(await art("jewel", "acc", "Accesorios"));
  const base = sanitizeThemeConfig({
    ...DEFAULT_THEME_CONFIG,
    colors: { primary: "#e52327", primaryDark: "#c4161a", ink: "#383e45", muted: "#685563", soft: "#f6f6f6", background: "#ffffff" },
    announcement: { enabled: true, text: "Envíos gratis en compras desde $60.000", href: "/tienda", bg: "#383e45", color: "#ffffff" },
    hero: [
      { image: h1.url, videoUrl: "", eyebrow: "Temporada nueva", title: "Lo mejor para tu casa y tu estilo", subtitle: "Descubrí las novedades con envíos a todo el país", promoText: "Hasta 6 cuotas", buttons: [{ label: "Ver la tienda", href: "/tienda" }, { label: "Ofertas", href: "/tienda?ofertas=1" }] },
      { image: h2.url, videoUrl: "", eyebrow: "Regalos", title: "Encontrá el regalo perfecto", subtitle: "Cajas listas para regalar", promoText: "", buttons: [{ label: "Ver regalos", href: "/categoria/regalos" }] },
    ],
    bannersTitle: "Explorá por rubro",
    banners: [{ image: b1.url, title: "Indumentaria", href: "/categoria/indumentaria", alt: "" }, { image: b2.url, title: "Hogar y deco", href: "/categoria/hogar-y-deco", alt: "" }, { image: b3.url, title: "Accesorios", href: "/categoria/accesorios", alt: "" }],
  });
  await prisma.theme.create({ data: { name: "Aspecto base de la tienda", isBase: true, enabled: true, config: base as object } });
  await prisma.theme.create({ data: { name: "Navidad", description: "Rojo y verde, con barra de anuncio.", enabled: true, startsAt: new Date(`${new Date().getFullYear()}-12-01T03:00:00Z`), endsAt: new Date(`${new Date().getFullYear()}-12-26T03:00:00Z`), config: configFromTemplate("navidad") as object } });
  await prisma.theme.create({ data: { name: "Black Friday", description: "Negro y amarillo de alto contraste.", enabled: false, config: configFromTemplate("black-friday") as object } });
  await ensurePagesSeeded();
  await prisma.page.updateMany({ where: { slug: { in: ["terminos-y-condiciones", "politica-de-privacidad"] } }, data: { enabled: true } });
  await ensureSegmentsSeeded();
  const logs: [string, string, string][] = [
    ["order.confirm", "Confirmó el pago", "Lucía Fernández — $14.800"], ["product.update", "Editó un producto", "Mochila urbana"], ["coupon.create", "Creó un cupón", "VERANO15"],
    ["theme.save", "Guardó un tema visual", "Navidad"], ["payment.update", "Editó un medio de pago", "Transferencia"], ["product.create", "Creó un producto", "Zapatillas urbanas"],
  ];
  for (const [i, [a, , d]] of logs.entries()) await prisma.adminLog.create({ data: { adminId: "admin-demo", adminEmail: "admin@tutienda.com", action: a, targetType: "demo", detail: d, createdAt: ago(i * 0.6) } });

  console.log("demo lista:", { categorias: cats.length, productos: products.length, clientes: users.length, pedidos: orders.length });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
