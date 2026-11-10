"use client";

import { useState } from "react";
import { MapPinIcon } from "@/components/icons";

export type StoreLocation = { id: string; title: string; street: string; city: string; query: string };

// "Dónde estamos": un mapa con una pestaña por local (las tarjetas de Datos de contacto que tienen dirección).
// Con un solo local se muestra su título como única pestaña.
export function StoreMap({ locations, franchiseLocation }: { locations: StoreLocation[]; franchiseLocation: string }) {
  const [activeId, setActiveId] = useState(locations[0]?.id);
  const active = locations.find((l) => l.id === activeId) ?? locations[0];
  if (!active) return null;
  // Con las tarjetas de contacto siempre se muestra el título del local (aunque haya uno solo); la dirección general de la tienda no lleva
  const showTabs = locations.length > 1 || active.id !== "tienda";

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-pink-dark">
        <span className="h-px w-4 bg-brand-pink" />
        {locations.length > 1 ? "Nuestras tiendas físicas" : "Nuestra tienda física"}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-brand-ink">Dónde estamos</h2>
      <p className="mt-2 max-w-2xl text-brand-muted">
        {locations.length > 1
          ? `Te esperamos en nuestros locales de ${franchiseLocation}. Vení a conocer todos nuestros productos.`
          : `Te esperamos en nuestro local en el centro de ${franchiseLocation}. Vení a conocer todos nuestros productos.`}
      </p>

      {/* Pestañas: una por local, arriba y a lo ancho */}
      {showTabs && (
        <div role="tablist" aria-label="Locales" className="mt-8 flex gap-1 overflow-x-auto border-b border-black/10">
          {locations.map((l) => {
            const selected = l.id === active.id;
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveId(l.id)}
                className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-[3px] px-5 py-3 text-sm font-bold uppercase tracking-wide transition-colors sm:px-7 sm:text-base ${
                  selected
                    ? "border-brand-pink text-brand-pink"
                    : "border-transparent text-brand-muted hover:border-black/20 hover:text-brand-ink"
                }`}
              >
                {l.title}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="w-full lg:w-[30%]">
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-pink/10 text-brand-pink-dark">
              <MapPinIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-ink">{active.street}</p>
              <p className="text-xs text-brand-muted">{active.city}</p>
            </div>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(active.query)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
          >
            Abrir en Google Maps →
          </a>
        </div>

        <div className="w-full overflow-hidden rounded-3xl border border-black/10 shadow-sm lg:w-[70%]">
          <iframe
            key={active.id}
            src={`https://www.google.com/maps?q=${encodeURIComponent(active.query)}&output=embed`}
            className="h-72 w-full grayscale-[15%] sm:h-96"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Ubicación de ${active.title} en el mapa`}
          />
        </div>
      </div>
    </div>
  );
}
