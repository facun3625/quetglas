"use client";

import { useState } from "react";

// Input de imagen con miniatura: muestra la imagen ya guardada (si hay) y la
// reemplaza por una vista previa al elegir un archivo nuevo, en vez del feo
// "Seleccionar archivo" nativo del navegador sin ningún feedback visual.
export function ImagePreviewInput({
  name,
  label,
  existingUrl,
  required,
  helperText,
}: {
  name: string;
  label: string;
  existingUrl?: string | null;
  required?: boolean;
  helperText?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const shown = preview ?? existingUrl ?? null;

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-brand-muted">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-brand-soft">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-[10px] leading-tight text-brand-muted">Sin imagen</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3.5 py-2 text-xs font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
            </svg>
            {existingUrl ? "Cambiar imagen" : "Elegir imagen"}
            <input
              type="file"
              name={name}
              accept="image/*"
              required={required}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setPreview(null);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setPreview(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {helperText && <p className="mt-1 text-xs text-brand-muted">{helperText}</p>}
        </div>
      </div>
    </div>
  );
}
