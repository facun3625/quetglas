import type { MetadataRoute } from "next";
import { getStoreSettingsRow } from "@/lib/settings";
import { resolveLogos } from "@/lib/logo";
import { iconVersion } from "@/lib/appIcon";

import { storeNameOf } from "@/lib/storeName";
export const dynamic = "force-dynamic";

// Manifiesto de la app instalable. El nombre es el de la tienda (Configuración → Franquicia) y los íconos salen del favicon
// cargado en Configuración → General → Logo e íconos (ver lib/appIcon.ts).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getStoreSettingsRow();
  const name = storeNameOf(settings);
  const v = iconVersion(resolveLogos(settings).favicon);
  return {
    name,
    short_name: name.length > 12 ? name.split(/\s[-–]\s/)[0].slice(0, 12) : name,
    description: `Tienda online de ${name}: descubrí el catálogo completo y comprá desde donde estés.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c4161a",
    icons: [
      { src: `/icons/app/192.png?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/icons/app/512.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/icons/app/512-maskable.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
