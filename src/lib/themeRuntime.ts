import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureBaseTheme } from "@/lib/baseTheme";
import { pickActiveTheme, sanitizeThemeConfig, type ThemeConfig } from "@/lib/themes";

export const THEME_PREVIEW_COOKIE = "theme_preview";

export type RequestTheme = { id: string; name: string; config: ThemeConfig; previewing: boolean };

// Tema que corresponde a este pedido: la vista previa (solo si quien mira es administrador) o el tema vigente por
// fechas. Sin tema vigente devuelve null y el sitio se ve con su aspecto base. Se cachea por pedido.
export const getThemeForRequest = cache(async (): Promise<RequestTheme | null> => {
  try {
    const previewId = (await cookies()).get(THEME_PREVIEW_COOKIE)?.value;
    if (previewId && /^[A-Za-z0-9_-]{1,64}$/.test(previewId)) {
      const session = await auth();
      if (session?.user?.role === "admin" || session?.user?.role === "superadmin") {
        const preview = await prisma.theme.findUnique({ where: { id: previewId } });
        if (preview) return { id: preview.id, name: preview.name, config: sanitizeThemeConfig(preview.config), previewing: true };
      }
    }
    const themes = await prisma.theme.findMany({ where: { enabled: true, isBase: false } });
    const active = pickActiveTheme(themes);
    if (active) return { id: active.id, name: active.name, config: sanitizeThemeConfig(active.config), previewing: false };
    // Sin campaña vigente: el aspecto base de la tienda (si el admin lo personalizó)
    const base = await ensureBaseTheme();
    return base ? { id: base.id, name: base.name, config: sanitizeThemeConfig(base.config), previewing: false } : null;
  } catch (err) {
    // Next usa una excepción interna para marcar la página como dinámica (por usar cookies): no hay que tragársela
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).includes("DYNAMIC_SERVER_USAGE")) throw err;
    // Un problema con los temas nunca debe tirar el sitio: se muestra el aspecto base
    console.error("getThemeForRequest failed", err);
    return null;
  }
});

// Portada de categoría propia de la campaña vigente, si cargó una para esa categoría. null = usar la del aspecto base.
export function categoryImageOverride(theme: RequestTheme | null, categoryId: string): string | null {
  return theme?.config.categoryImages[categoryId] || null;
}
