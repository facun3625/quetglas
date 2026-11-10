import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME_CONFIG, sanitizeThemeConfig, type ThemeConfig } from "@/lib/themes";

export const BASE_THEME_NAME = "Aspecto base de la tienda";

// Los slides que antes se cargaban en Configuración → Slider (tabla HeroSlide) pasan al aspecto base la primera vez:
// desde ahora el slider se maneja dentro de cada tema. La tabla vieja queda guardada sin usar.
async function legacySlidesAsHero(): Promise<ThemeConfig["hero"]> {
  const rows = await prisma.heroSlide.findMany({ where: { enabled: true }, orderBy: { position: "asc" } });
  return rows.map((s) => ({
    image: s.imageUrl ?? "/hero-bg.jpg",
    videoUrl: "",
    eyebrow: s.eyebrow,
    title: s.title,
    subtitle: s.subtitle ?? "",
    promoText: s.promoText ?? "",
    buttons: (
      [
        [s.button1Label, s.button1Href],
        [s.button2Label, s.button2Href],
        [s.button3Label, s.button3Href],
      ] as const
    )
      .filter((b): b is [string, string] => Boolean(b[0] && b[1]))
      .map(([label, href]) => ({ label, href })),
  }));
}

// El aspecto base: lo que se ve cuando no hay ninguna campaña vigente. Devuelve null si todavía no existe y no hay
// slides viejos que migrar (en ese caso el sitio usa su aspecto y slider de fábrica).
export async function ensureBaseTheme() {
  const existing = await prisma.theme.findFirst({ where: { isBase: true } });
  if (existing) return existing;
  if ((await prisma.heroSlide.count()) === 0) return null;
  return createBaseTheme();
}

export async function createBaseTheme() {
  return prisma.$transaction(async (tx) => {
    // Candado para que dos pedidos simultáneos no creen dos aspectos base
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(48210001)`;
    const again = await tx.theme.findFirst({ where: { isBase: true } });
    if (again) return again;
    const config = sanitizeThemeConfig({ ...DEFAULT_THEME_CONFIG, hero: await legacySlidesAsHero() });
    return tx.theme.create({ data: { name: BASE_THEME_NAME, isBase: true, enabled: true, config: config as object } });
  }, { timeout: 15000 });
}
