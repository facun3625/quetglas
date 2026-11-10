"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import type { CustomTag } from "@/lib/seoTags";

// Mide y verifica el sitio público: Google Analytics, Tag Manager, Píxel de Meta y las etiquetas propias que cargó el
// superadmin. No corre dentro del panel (/admin) para no contar al equipo como visitas.
// Los IDs llegan ya validados por formato (ver lib/seoTags.ts).

const ATTR_TO_REACT: Record<string, string> = { "http-equiv": "httpEquiv", charset: "charSet", crossorigin: "crossOrigin", referrerpolicy: "referrerPolicy", class: "className", hreflang: "hrefLang", fetchpriority: "fetchPriority" };
function reactAttrs(attrs: Record<string, string>) {
  return Object.fromEntries(Object.entries(attrs).map(([k, v]) => [ATTR_TO_REACT[k] ?? k, v]));
}

export function SiteTags({ gaId, gtmId, pixelId, tags }: { gaId: string | null; gtmId: string | null; pixelId: string | null; tags: CustomTag[] }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <>
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}</Script>
      )}
      {gaId && (
        <>
          <Script id="ga-lib" src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}</Script>
        </>
      )}
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src='https://connect.facebook.net/en_US/fbevents.js';s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script');fbq('init','${pixelId}');fbq('track','PageView');`}</Script>
      )}
      {tags.map((t, i) => {
        if (t.kind === "meta") return <meta key={i} {...reactAttrs(t.attrs)} />;
        if (t.kind === "link") return <link key={i} {...reactAttrs(t.attrs)} />;
        return t.inline !== undefined ? (
          <Script key={i} id={`custom-tag-${i}`} strategy="afterInteractive">{t.inline}</Script>
        ) : (
          <Script key={i} id={`custom-tag-${i}`} src={t.attrs.src} strategy="afterInteractive" />
        );
      })}
    </>
  );
}
