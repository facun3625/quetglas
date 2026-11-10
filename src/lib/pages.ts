import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

// Páginas base que trae toda tienda. Se crean una sola vez con un texto de ejemplo para que el
// admin lo complete. Las legales arrancan DESACTIVADAS: son textos del negocio y no se publican
// hasta que el dueño los revisa y los activa.
const SEED: { slug: string; title: string; content: string; enabled: boolean; showContactForm?: boolean; showInMenu?: boolean }[] = [
  {
    slug: "quienes-somos",
    title: "Quiénes somos",
    enabled: true,
    content: "<p>Contá acá la historia de tu negocio: cuándo empezó, qué hacen, qué los diferencia y qué pueden esperar los clientes.</p>",
  },
  {
    slug: "contacto",
    title: "Contacto",
    enabled: true,
    showContactForm: true,
    content: "<p>¿Tenés una consulta? Escribinos y te respondemos a la brevedad.</p>",
  },
  {
    slug: "terminos-y-condiciones",
    showInMenu: false,
    title: "Términos y condiciones",
    enabled: false,
    content: "<p>Escribí acá los términos y condiciones de uso de la tienda y de compra. Recomendamos que los revise un profesional.</p>",
  },
  {
    slug: "politica-de-privacidad",
    showInMenu: false,
    title: "Política de privacidad",
    enabled: false,
    content: "<p>Explicá qué datos personales recolecta la tienda, para qué los usa y cómo pueden los clientes ejercer sus derechos.</p>",
  },
  {
    slug: "cambios-y-devoluciones",
    showInMenu: false,
    title: "Cambios y devoluciones",
    enabled: false,
    content: "<p>Indicá los plazos, condiciones y el procedimiento para cambios, devoluciones y el botón de arrepentimiento.</p>",
  },
  {
    slug: "envios",
    showInMenu: false,
    title: "Envíos y entregas",
    enabled: false,
    content: "<p>Detallá las modalidades de envío, zonas, costos y tiempos de entrega, y las opciones de retiro.</p>",
  },
];

export async function ensurePagesSeeded() {
  if ((await prisma.page.count()) > 0) return;
  await prisma.page.createMany({
    data: SEED.map((p, i) => ({ showInMenu: true, ...p, sortOrder: i, showInFooter: true })),
    skipDuplicates: true,
  });
}

export async function getPublicPage(slug: string) {
  await ensurePagesSeeded();
  const page = await prisma.page.findFirst({ where: { slug, enabled: true } });
  return page ? { ...page, content: sanitizeRichHtml(page.content) } : null;
}

export async function getFooterPages() {
  await ensurePagesSeeded();
  return prisma.page.findMany({
    where: { enabled: true, showInFooter: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });
}

// Páginas publicadas que van en el menú de arriba (las legales se tildan a mano si se quieren ahí)
export async function getMenuPages() {
  await ensurePagesSeeded();
  return prisma.page.findMany({
    where: { enabled: true, showInMenu: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });
}
