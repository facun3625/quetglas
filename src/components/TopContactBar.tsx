import { MapPinIcon, InstagramIcon } from "@/components/icons";
import { instagramHandle } from "@/lib/contactLinks";

// Extraída de Navbar para poder reusarla tal cual en /mantenimiento, que no
// lleva el resto del navbar (menú, buscador, carrito).
//
// Con tarjetas de "Datos de contacto" cargadas: a la izquierda va la ciudad (en vez de la dirección) y a la derecha los
// Instagram de las tarjetas (sin repetir). Sin tarjetas queda como siempre: dirección, ciudad y el Instagram de la tienda.
export function TopContactBar({
  settings,
}: {
  settings: { address: string; instagramHandle: string; franchiseLocation: string; contactCards?: { instagram: string | null }[] };
}) {
  const handles = Array.from(new Set((settings.contactCards ?? []).map((c) => (c.instagram ? instagramHandle(c.instagram) : "")).filter(Boolean)));
  const hasCards = (settings.contactCards ?? []).length > 0;

  if (hasCards) {
    // "San Martín 2191 — Santa Fe, Argentina" → "Santa Fe, Argentina"
    const city = settings.address.includes(" — ") ? settings.address.split(" — ").slice(1).join(" — ") : settings.franchiseLocation;
    const shown = (handles.length > 0 ? handles : [settings.instagramHandle]).filter(Boolean);
    return (
      <div className="bg-brand-pink px-3 py-2.5 text-xs font-medium tracking-wide text-white/95 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{city}</span>
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
            {shown.map((h) => (
              <a
                key={h}
                href={`https://instagram.com/${h}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram @${h}`}
                className="flex items-center gap-1.5 transition-colors hover:text-white/70"
              >
                <InstagramIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">@{h}</span>
              </a>
            ))}
          </span>
        </div>
      </div>
    );
  }

  // Sin datos cargados (ni dirección ni Instagram) no hay nada que mostrar: la barra no aparece
  if (!settings.address && !settings.instagramHandle) return null;

  return (
    <div className="bg-brand-pink px-3 py-2.5 text-xs font-medium tracking-wide text-white/95 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-2 sm:grid-cols-3">
        <span className="flex items-center gap-1.5">
          {settings.address && <MapPinIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="sm:hidden">{settings.address ? settings.franchiseLocation : ""}</span>
          <span className="hidden sm:inline">{settings.address}</span>
        </span>
        <span className="hidden justify-self-center sm:block">
          {settings.address && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              {settings.franchiseLocation}
            </span>
          )}
        </span>
        {settings.instagramHandle ? (
          <a
            href={`https://instagram.com/${settings.instagramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-self-end gap-1.5 transition-colors hover:text-white/70"
          >
            <InstagramIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">@{settings.instagramHandle}</span>
          </a>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
