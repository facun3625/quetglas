import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";
import { TopContactBar } from "@/components/TopContactBar";
import { MaintenanceHero } from "./MaintenanceHero";

// Página que proxy.ts muestra (via rewrite) en vez del sitio real cuando el
// mantenimiento está prendido y quien visita no es admin. No usa el
// Navbar/Footer normales (ver SiteChrome) — encabezado propio, minimalista:
// solo la barra superior de contacto + el logo, sin menú/buscador/carrito,
// y sin footer.
//
// Forzada a dynamic: si no, Next la deja estática y el número de WhatsApp
// queda pegado al valor que tenía en el build en vez del actual.
export const dynamic = "force-dynamic";

export default async function MantenimientoPage() {
  const settings = await getSiteSettings();

  return (
    <div className="min-h-screen bg-white">
      <TopContactBar settings={settings} />

      <div className="border-b border-black/5 px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-center">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={settings.logos.header} alt={settings.franchiseName} className="h-14 w-auto sm:h-16" />
          </Link>
        </div>
      </div>

      <MaintenanceHero whatsappNumber={settings.whatsappNumber} />
    </div>
  );
}
