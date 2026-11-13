import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { THEME_PREVIEW_COOKIE, THEME_PREVIEW_PARAM } from "@/lib/themeRuntime";

// Abre la vista previa de un tema (solo administradores). La vista previa va en el link (/?vista_previa=<id>), así
// solo esa pestaña muestra el tema y se puede comparar con la tienda real en otra.
//   /api/admin/themes/preview?id=<tema>   -> abre la tienda con ese tema
//   /api/admin/themes/preview?exit=1      -> vuelve al panel de temas
// Redirección relativa: detrás de Nginx, req.url es la dirección interna (http://localhost:3020), así que armar una URL
// absoluta con ella mandaba al navegador a localhost. Con una ruta relativa el navegador se queda en el dominio real.
function redirectTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return redirectTo("/login");
  }
  const url = new URL(req.url);
  if (url.searchParams.get("exit")) {
    const res = redirectTo("/admin/temas");
    res.cookies.delete(THEME_PREVIEW_COOKIE);
    return res;
  }
  const id = url.searchParams.get("id") ?? "";
  const theme = /^[A-Za-z0-9_-]{1,64}$/.test(id) ? await prisma.theme.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!theme) return redirectTo("/admin/temas");
  // La vista previa viaja en el link: solo esa pestaña ve el tema (ver proxy.ts). Se borra la cookie vieja si quedó.
  const res = redirectTo(`/?${THEME_PREVIEW_PARAM}=${encodeURIComponent(theme.id)}`);
  res.cookies.delete(THEME_PREVIEW_COOKIE);
  return res;
}
