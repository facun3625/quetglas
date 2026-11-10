import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { THEME_PREVIEW_COOKIE } from "@/lib/themeRuntime";

// Entra o sale de la vista previa de un tema (solo administradores). La vista previa vive en una cookie de sesión:
// nadie más ve el tema hasta que se lo active.
//   /api/admin/themes/preview?id=<tema>   -> activa la vista previa y abre la tienda
//   /api/admin/themes/preview?exit=1      -> la desactiva y vuelve al panel de temas
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const url = new URL(req.url);
  if (url.searchParams.get("exit")) {
    const res = NextResponse.redirect(new URL("/admin/temas", req.url));
    res.cookies.delete(THEME_PREVIEW_COOKIE);
    return res;
  }
  const id = url.searchParams.get("id") ?? "";
  const theme = /^[A-Za-z0-9_-]{1,64}$/.test(id) ? await prisma.theme.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!theme) return NextResponse.redirect(new URL("/admin/temas", req.url));
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(THEME_PREVIEW_COOKIE, theme.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  return res;
}
