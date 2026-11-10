import Link from "next/link";
import { WhatsAppIcon, InstagramIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import { instagramHandle, phoneHref, whatsappHref } from "@/lib/contactLinks";
import { InstallPwaButton } from "@/components/InstallPwaButton";
import type { SiteSettings } from "@/lib/settings";

// Las tarjetas se reparten el ancho: 1, 2, 3 o 4 columnas según cuántas haya (máximo 4 por fila; con 5 o 6 quedan 3 por fila, con 7 u 8 quedan 4).
const GRID = [
  "",
  "",
  "sm:grid-cols-2",
  "sm:grid-cols-2 lg:grid-cols-3",
  "sm:grid-cols-2 lg:grid-cols-4",
  "sm:grid-cols-2 lg:grid-cols-3",
  "sm:grid-cols-2 lg:grid-cols-3",
  "sm:grid-cols-2 lg:grid-cols-4",
  "sm:grid-cols-2 lg:grid-cols-4",
];

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  const cards = settings.contactCards;

  return (
    <footer id={cards.length === 0 ? "contacto" : undefined} className="border-t border-black/5 bg-white">
      {cards.length > 0 && (
        // Datos de contacto: tarjetas que se cargan desde el panel (Contacto). Máximo 4 columnas; si hay más, bajan a otra fila.
        // El enlace "Contacto" del menú lleva hasta acá.
        <section id="contacto" className="scroll-mt-36 border-b border-black/5">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <div className="flex items-center gap-6">
              <span className="h-px flex-1 bg-black/10" />
              <h2 className="text-lg font-semibold uppercase tracking-wide text-brand-ink sm:text-xl">Datos de contacto</h2>
              <span className="h-px flex-1 bg-black/10" />
            </div>
            <div className={`mt-10 grid grid-cols-1 gap-x-10 gap-y-10 ${GRID[Math.min(cards.length, 8)]}`}>
              {cards.map((c) => (
                <div key={c.id} className="min-w-0">
                  <h3 className="border-b border-black/10 pb-3 text-base font-semibold uppercase tracking-wide text-brand-ink">{c.title}</h3>
                  <ul className="mt-5 space-y-3 text-sm text-brand-ink">
                    {c.address && (
                      <li className="flex items-start gap-3">
                        <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink-dark" />
                        <span>{c.address}</span>
                      </li>
                    )}
                    {c.phone && (
                      <li className="flex items-start gap-3">
                        <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink-dark" />
                        <a href={phoneHref(c.phone)} className="hover:text-brand-pink-dark">{c.phone}</a>
                      </li>
                    )}
                    {c.whatsapp && (
                      <li className="flex items-start gap-3">
                        <WhatsAppIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                        <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener noreferrer" className="hover:text-brand-pink-dark">{c.whatsapp}</a>
                      </li>
                    )}
                    {c.instagram && (
                      <li className="flex items-start gap-3">
                        <InstagramIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink-dark" />
                        <a href={`https://instagram.com/${instagramHandle(c.instagram)}`} target="_blank" rel="noopener noreferrer" className="min-w-0 break-words hover:text-brand-pink-dark">@{instagramHandle(c.instagram)}</a>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 ${cards.length > 0 ? "justify-items-center text-center" : "sm:grid-cols-3"}`}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.logos.footer} alt={settings.franchiseName} className={`h-8 w-auto ${cards.length > 0 ? "mx-auto" : ""}`} />
          <p className="mx-auto mt-4 max-w-xs text-sm text-brand-muted">{settings.footerText}</p>
          <div className={`mt-4 ${cards.length > 0 ? "flex justify-center" : ""}`}>
            <InstallPwaButton />
          </div>
        </div>

        {cards.length === 0 && (
          <div>
            <p className="text-sm font-semibold text-brand-ink">Navegación</p>
            <ul className="mt-4 space-y-2 text-sm text-brand-muted">
              <li>
                <Link href="/" className="hover:text-brand-pink-dark">Inicio</Link>
              </li>
              <li>
                <Link href="/tienda" className="hover:text-brand-pink-dark">Tienda</Link>
              </li>
              <li>
                <Link href="/#donde-estamos" className="hover:text-brand-pink-dark">Dónde estamos</Link>
              </li>
              {settings.footerPages.map((p) => (
                <li key={p.slug}>
                  <Link href={`/pagina/${p.slug}`} className="hover:text-brand-pink-dark">{p.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Con las tarjetas de "Datos de contacto" arriba, esta columna sobra */}
        {cards.length === 0 && (
          <div>
            <p className="text-sm font-semibold text-brand-ink">Contacto</p>
            <ul className="mt-4 space-y-3 text-sm text-brand-muted">
              {settings.whatsappNumber && (
                <li className="flex items-center gap-2">
                  <WhatsAppIcon className="h-4 w-4 shrink-0" />
                  {/* Mismo horario que configura el admin para la vendedora IA
                      (ver /admin/configuracion → horario de WhatsApp) — fuera de
                      esas horas no tiene sentido invitar a escribir. */}
                  {settings.assistant.humanSeller.available && settings.assistant.humanSeller.whatsappUrl ? (
                    <a
                      href={settings.assistant.humanSeller.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-brand-pink-dark"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <span title={`Fuera de horario — ${settings.assistant.humanSeller.scheduleText}`} className="text-brand-muted/50">
                      WhatsApp (fuera de horario)
                    </span>
                  )}
                </li>
              )}
              {settings.contactEmail && (
                <li className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-brand-pink-dark">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.instagramHandle && (
                <li className="flex items-center gap-2">
                  <InstagramIcon className="h-4 w-4 shrink-0" />
                  <a
                    href={`https://instagram.com/${settings.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-pink-dark"
                  >
                    @{settings.instagramHandle}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-black/5 px-6 py-6 pr-20 text-center text-xs text-brand-muted sm:pr-6">
        © {year} {settings.franchiseName}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
