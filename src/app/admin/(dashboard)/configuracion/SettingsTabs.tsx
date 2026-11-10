"use client";

import { useState, type ReactNode } from "react";

// Tabs de Configuración. Recibe los paneles ya renderizados del server (cada
// uno con sus forms + server actions) y solo alterna cuál se ve, así se
// encuentra todo sin scrollear una página larga. Los paneles quedan montados
// (hidden) para no perder lo que se haya tipeado al cambiar de pestaña.
export function SettingsTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <div className="mt-6">
      <div role="tablist" className="flex flex-wrap gap-x-0.5 border-b border-black/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`-mb-px cursor-pointer whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
              active === t.id
                ? "border-brand-pink text-brand-pink-dark"
                : "border-transparent text-brand-muted hover:text-brand-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="pt-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}
