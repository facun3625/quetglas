import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { THEME_PREVIEW_COOKIE } from "@/lib/themeRuntime";

// Entra o sale de la vista previa de un tema (solo administradores). La vista previa vive en una cookie de sesión:
// nadie más ve el tema hasta que se lo active.
//   /api/admin/themes/preview?id=<tema>   -> activa la vista previa y abre la tienda
//   /api/admin/themes/preview?exit=1      -> la desactiva y vuelve al panel de temas
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
  const res = redirectTo("/");
  res.cookies.set(THEME_PREVIEW_COOKIE, theme.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  return res;
}
