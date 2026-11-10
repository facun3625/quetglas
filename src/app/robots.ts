import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";
import { getStoreSettingsRow } from "@/lib/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { seoIndexable } = await getStoreSettingsRow();
  // Sitio en preparación: se le pide a los buscadores que no lo indexen (Configuración → SEO y etiquetas)
  if (!seoIndexable) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/carrito", "/mi-cuenta", "/login", "/registro", "/recuperar", "/integraciones", "/mantenimiento"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
