"use client";

import { useEffect, useRef, useState } from "react";
import { BENEFIT_ICON_OPTIONS } from "@/components/icons";

// Selector visual de ícono para un ítem de la franja de beneficios — un
// <select> nativo no muestra el ícono en sí, así que esto es una grilla de
// botones con el ícono real, mismo patrón de "input hidden + dispatch change"
// que CategoryChipSelector para que useFormDirty detecte el cambio.
export function IconPicker({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [value, setValue] = useState(defaultValue ?? BENEFIT_ICON_OPTIONS[0].key);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    containerRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [value]);

  const selectedOption = BENEFIT_ICON_OPTIONS.find((o) => o.key === value) ?? BENEFIT_ICON_OPTIONS[0];

  return (
    <div ref={containerRef}>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1.5">
        {BENEFIT_ICON_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setValue(opt.key)}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={value === opt.key}
            className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
              value === opt.key
                ? "border-brand-pink bg-brand-soft text-brand-pink-dark"
                : "border-black/10 text-brand-muted hover:border-brand-pink/40 hover:text-brand-ink"
            }`}
          >
            <opt.Icon className="h-4.5 w-4.5" />
          </button>
        ))}
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-muted">
        <selectedOption.Icon className="h-3.5 w-3.5 text-brand-pink-dark" />
        {selectedOption.label}
      </p>
    </div>
  );
}
