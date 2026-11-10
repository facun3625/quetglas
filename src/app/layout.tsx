import { resolveLogos } from "@/lib/logo";
import { getStoreSettingsRow } from "@/lib/settings";
import { iconVersion } from "@/lib/appIcon";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/Providers";
import { SiteChrome } from "@/components/SiteChrome";
import { SiteTags } from "@/components/SiteTags";
import { cleanGaId, cleanGtmId, cleanPixelId, parseCustomTags } from "@/lib/seoTags";
import { getSiteSettings } from "@/lib/settings";
import { getThemeForRequest } from "@/lib/themeRuntime";
import { themeCss, themeFontHref } from "@/lib/themes";
import "./globals.css";

import { storeNameOf } from "@/lib/storeName";
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Título y descripción fijos; el ícono (favicon) es el que subió el admin, o el original de la instalación
export async function generateMetadata(): Promise<Metadata> {
  const row = await getStoreSettingsRow();
  const { favicon } = resolveLogos(row);
  const v = iconVersion(favicon);
  const name = storeNameOf(row);
  const title = row.seoTitle?.trim() || name;
  const description = row.seoDescription?.trim() || `${name} — descubrí el catálogo completo y comprá online.`;
  const image = row.seoImageUrl?.trim() || null;
  const other: Record<string, string> = {};
  if (row.facebookDomainVerification) other["facebook-domain-verification"] = row.facebookDomainVerification;
  return {
    title,
    description,
    // Al compartir el sitio en redes (WhatsApp, Facebook, Instagram, X…)
    openGraph: { title, description, siteName: name, type: "website", locale: "es_AR", images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
    robots: row.seoIndexable ? undefined : { index: false, follow: false },
    verification: { google: row.googleSiteVerification || undefined, other: Object.keys(other).length ? other : undefined },
    manifest: "/manifest.webmanifest",
    // capable: true es lo que hace que, instalada, abra sin la barra de
    // Safari. Sin icons.apple, Safari muestra una captura de pantalla en vez
    // del logo como ícono — los tres campos van juntos, no alcanza con el
    // manifest solo (Safari no lo lee para esto).
    appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
    icons: {
      icon: favicon ?? `/icons/app/512.png?v=${v}`,
      // En el iPhone el ícono tiene que ser un PNG con fondo: se usa el armado a medida, no la imagen cargada tal cual
      apple: `/icons/app/192.png?v=${v}`,
    },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, requestHeaders, theme, row] = await Promise.all([getSiteSettings(), headers(), getThemeForRequest(), getStoreSettingsRow()]);
  const customTags = parseCustomTags(row.customHeadCode).tags;
  const fontHref = theme ? themeFontHref(theme.config) : null;
  const isMaintenancePage = requestHeaders.get("x-maintenance-page") === "1";

  return (
    <html lang="es" className={`${poppins.variable} h-full antialiased`}>
      <head>
        {/* Tema de campaña vigente: colores, tipografía de títulos, botones y fondo (valores ya validados en lib/themes.ts) */}
        {theme && <style id="theme-css" dangerouslySetInnerHTML={{ __html: themeCss(theme.config) }} />}
        {fontHref && <link rel="stylesheet" href={fontHref} />}
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteTags gaId={cleanGaId(row.gaMeasurementId ?? "")} gtmId={cleanGtmId(row.gtmId ?? "")} pixelId={cleanPixelId(row.metaPixelId ?? "")} tags={customTags} />
        <Providers currency={settings.currency} cartAutoCloseSeconds={settings.cartAutoCloseSeconds}>
          <SiteChrome settings={settings} isMaintenancePage={isMaintenancePage} announcement={theme?.config.announcement.enabled ? theme.config.announcement : null} previewThemeName={theme?.previewing ? theme.name : null}>
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
