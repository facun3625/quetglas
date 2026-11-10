"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SalesAssistant } from "@/components/SalesAssistant";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import { VisitTracker } from "@/components/VisitTracker";
import { SitePopupModal } from "@/components/SitePopupModal";
import { PushPrompt } from "@/components/PushPrompt";
import type { SiteSettings } from "@/lib/settings";
import { BASE_COLORS } from "@/lib/themes";

// El panel de administración no toma los temas de campaña: vuelve a los colores base
const ADMIN_BASE_VARS = {
  "--color-brand-pink": BASE_COLORS.primary,
  "--color-brand-pink-dark": BASE_COLORS.primaryDark,
  "--color-brand-ink": BASE_COLORS.ink,
  "--color-brand-muted": BASE_COLORS.muted,
  "--color-brand-soft": BASE_COLORS.soft,
  "--background": BASE_COLORS.background,
  "--foreground": BASE_COLORS.ink,
} as React.CSSProperties;

// El panel de administración tiene su propio layout (sidebar, header) y no
// debe mostrar el navbar/footer/whatsapp del sitio público.
export function SiteChrome({
  children,
  settings,
  isMaintenancePage,
  announcement,
  previewThemeName,
}: {
  children: ReactNode;
  settings: SiteSettings;
  isMaintenancePage: boolean;
  // Barra de anuncio del tema vigente (null = no hay)
  announcement: { text: string; href: string; bg: string; color: string } | null;
  // Si un administrador está viendo la vista previa de un tema, su nombre
  previewThemeName: string | null;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  // Página de integraciones (IA y mail): aparte de /admin a propósito, pero misma
  // idea — pantalla propia, sin navbar/footer/whatsapp del sitio público.
  const isIntegrations = pathname === "/integraciones";
  // Pantalla única de la cuenta genérica de sucursal (rol couponStaff, ver
  // proxy.ts) — tampoco lleva navbar/footer/whatsapp del sitio público.
  const isCuponRapido = pathname === "/cupon-rapido";

  if (isAdmin) {
    // El dashboard admin maneja su propio scroll interno (sidebar fijo +
    // contenido scrolleable) — hay que capar esto a la altura de la
    // pantalla, si no el body entero crece con el contenido y el sidebar
    // (que sí es h-screen) se queda corto.
    return <div className="admin-root h-screen overflow-hidden" style={ADMIN_BASE_VARS}>{children}</div>;
  }

  if (isIntegrations || isCuponRapido) {
    return <div className="admin-root" style={ADMIN_BASE_VARS}>{children}</div>;
  }

  // La pantalla de mantenimiento arma su propio encabezado mínimo (solo
  // logo, sin menú/buscador/carrito) y no lleva footer — se renderiza sola.
  // `isMaintenancePage` viene del layout (que lo lee de un header que puso
  // proxy.ts) porque acá, del lado del cliente, la URL sigue siendo la
  // original (el rewrite es transparente para el navegador) — usePathname()
  // solo no alcanzaría para darse cuenta.
  if (isMaintenancePage) {
    return <>{children}</>;
  }

  return (
    <>
      <VisitTracker />
      {announcement && announcement.text && (
        <div className="px-4 py-2 text-center text-xs font-semibold sm:text-sm" style={{ backgroundColor: announcement.bg, color: announcement.color }}>
          {announcement.href ? (
            <a href={announcement.href} className="hover:underline">{announcement.text}</a>
          ) : (
            announcement.text
          )}
        </div>
      )}
      <Navbar settings={settings} />
      <div className="flex-1">{children}</div>
      <Footer settings={settings} />
      {settings.assistant.enabled ? (
        <SalesAssistant settings={settings.assistant} />
      ) : (
        <WhatsAppFloatingButton humanSeller={settings.assistant.humanSeller} />
      )}
      <SitePopupModal popup={settings.popup} />
      <PushPrompt />
      {previewThemeName && (
        <div className="fixed inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-3 bg-brand-ink px-4 py-2.5 text-center text-xs text-white sm:text-sm">
          <span>Vista previa del tema <b>{previewThemeName}</b>: solo la ves vos.</span>
          <a href="/api/admin/themes/preview?exit=1" className="rounded-full bg-white px-3 py-1 font-semibold text-brand-ink hover:bg-brand-soft">Salir de la vista previa</a>
        </div>
      )}
    </>
  );
}
