import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStoreSettingsRow } from "@/lib/settings";

// `middleware.ts` fue renombrado a `proxy.ts` en esta versión de Next.js —
// y a diferencia del middleware "de siempre" (Edge runtime), acá corre en
// Node.js por defecto, así que sí podemos leer la base de datos directo.
//
// El flag de mantenimiento se cachea unos segundos en memoria del módulo
// para no pegarle a la base en cada pageview público. Ojo: la doc de Next
// avisa explícitamente que Proxy corre en un contexto separado del resto
// del server ("no confíes en módulos/globals compartidos") — por eso este
// cache es solo un TTL corto, no algo que se "resetea" desde afuera al
// guardar la config; tarda como mucho unos segundos en notarse el cambio.
const MAINTENANCE_TTL_MS = 10_000;
let cachedMaintenance = false;
let cachedAt = 0;

async function isMaintenanceOn(): Promise<boolean> {
  const now = Date.now();
  if (now - cachedAt < MAINTENANCE_TTL_MS) return cachedMaintenance;

  try {
    const settings = await getStoreSettingsRow();
    cachedMaintenance = settings.maintenanceMode;
  } catch {
    cachedMaintenance = false; // si falla la base, no le tapamos el sitio a nadie
  }
  cachedAt = now;
  return cachedMaintenance;
}

// Auth revalida el rol del JWT contra la base en cada solicitud para
// proteger /admin. No hay login propio del panel: se usa el mismo login del
// sitio (AuthModal); si esa cuenta no es admin, se manda al home.
// Cuenta genérica de sucursal (sin panel): solo puede estar en esta pantalla,
// se la manda para acá desde cualquier otra ruta que pida.
const COUPON_STAFF_PATH = "/cupon-rapido";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const isAdminUser = req.auth?.user?.role === "admin" || req.auth?.user?.role === "superadmin";
  const isCouponStaffUser = req.auth?.user?.role === "couponStaff";

  if (isCouponStaffUser && pathname !== COUPON_STAFF_PATH) {
    return NextResponse.redirect(new URL(COUPON_STAFF_PATH, req.url));
  }

  if (pathname.startsWith("/admin")) {
    if (!isAdminUser) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  // El manual se comparte con franquicias potenciales como material de
  // venta (ver src/app/manual/route.ts) — tiene que verse aunque el sitio
  // esté en mantenimiento, si no el link queda inservible justo cuando más
  // se necesita mandarlo.
  if (pathname === "/manual-tienda") {
    const manualUrl = new URL("/presentacion", req.url);
    const headers = new Headers(req.headers);
    headers.set("x-document-name", "cortopassi-tienda");
    return NextResponse.rewrite(manualUrl, { request: { headers } });
  }

  if (pathname === "/manual" || pathname === "/presentacion") {
    return NextResponse.next();
  }

  // Alguien visitando /mantenimiento directo también lleva el encabezado
  // minimalista (ver comentario más abajo sobre por qué hace falta el header).
  if (pathname === "/mantenimiento") {
    const headers = new Headers(req.headers);
    headers.set("x-maintenance-page", "1");
    return NextResponse.next({ request: { headers } });
  }

  // Los admins navegan el sitio público normal (para poder revisarlo)
  // incluso con el mantenimiento prendido — solo se tapa para el resto.
  if (!isAdminUser && (await isMaintenanceOn())) {
    // El rewrite es transparente para el navegador: la URL sigue siendo la
    // original, así que un componente de cliente como SiteChrome (que mira
    // usePathname()) no tiene forma de saber que en realidad está sirviendo
    // /mantenimiento. Este header viaja hasta el layout (que sí lo puede
    // leer con headers(), del lado del server) para avisarle.
    const headers = new Headers(req.headers);
    headers.set("x-maintenance-page", "1");
    return NextResponse.rewrite(new URL("/mantenimiento", req.url), { request: { headers } });
  }

  return NextResponse.next();
});

export const config = {
  // Los íconos, el manifiesto y el service worker no pasan por acá: tienen que verse siempre (también con el modo mantenimiento prendido)
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo2.png|uploads/|icons/|manifest.webmanifest|sw.js).*)"],
};
