"use client";

import { useFormDirty } from "@/lib/useFormDirty";

// trackDirty: para items que ya existen guardados (un cupón editado, un
// medio de envío, una recompensa...) el botón arranca "apagado" y recién se
// pone en rosa cuando se modificó algo del form — así se nota que hay un
// cambio sin guardar. Los forms de "crear algo nuevo" no lo usan: siempre
// tienen algo para guardar, así que el botón se ve activo desde el vamos.
export function SaveButton({ label = "Guardar", trackDirty = false }: { label?: string; trackDirty?: boolean }) {
  const { ref, dirty, pending, justSaved } = useFormDirty<HTMLButtonElement>();
  const highlight = !trackDirty || dirty;

  return (
    <span className="inline-flex items-center gap-2.5">
      <button
        ref={ref}
        type="submit"
        disabled={pending}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
          highlight
            ? "bg-brand-pink text-white shadow-sm hover:bg-brand-pink-dark"
            : "bg-black/5 text-brand-muted hover:bg-black/10"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
        {pending ? "Guardando..." : label}
      </button>

      {justSaved && (
        <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
          Guardado
        </span>
      )}
    </span>
  );
}
