"use client";

import { useState, type ReactNode } from "react";

type SectionTab = {
  id: string;
  label: string;
  // Elemento ya renderizado (<SendIcon .../>), no el componente en sí — una
  // referencia a función no se puede pasar de un server component a uno de
  // cliente (React tira "Functions cannot be passed directly..."), pero un
  // elemento JSX ya armado sí cruza esa frontera sin problema.
  icon: ReactNode;
  badge?: string;
  content: ReactNode;
};

// "Segundo sidebar" reutilizable para partir en pestañas una sección del
// admin que si no queda como un choclo (todo apilado en una sola pantalla
// larga) — usado en Mailing (Mail / Campañas / Disponibilidad) y en
// Cupones (Rápido / Activos / Nuevo). Los paneles quedan todos montados
// (hidden) para no perder lo que se esté escribiendo al mirar otra pestaña.
export function SectionSidebar({ tabs }: { tabs: SectionTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col lg:gap-1 lg:overflow-visible">
        {tabs.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActive(t.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                isActive ? "bg-brand-pink/10 text-brand-pink-dark" : "text-brand-muted hover:bg-black/[0.03] hover:text-brand-ink"
              }`}
            >
              {t.icon}
              <span className="whitespace-nowrap lg:whitespace-normal">{t.label}</span>
              {t.badge && (
                <span
                  className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isActive ? "bg-brand-pink text-white" : "bg-black/5 text-brand-muted"
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {tabs.map((t) => (
          <div key={t.id} hidden={active !== t.id}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
