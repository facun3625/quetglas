"use client";

import { useState } from "react";

// Campo de imagen para logos/ícono: sube al almacenamiento de imágenes (R2 o disco), muestra una vista previa y guarda
// la URL en un input oculto del formulario. "Quitar" vuelve al original de la instalación.
export function LogoField({
  name,
  label,
  hint,
  initialUrl,
  fallbackUrl,
  previewClass = "h-12",
  onValueChange,
}: {
  name: string;
  label: string;
  hint: string;
  initialUrl: string;
  fallbackUrl: string | null;
  previewClass?: string;
  // Para formularios controlados: avisa cada vez que cambia la imagen (el input oculto igual se envía en formularios nativos)
  onValueChange?: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = url || fallbackUrl;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/images", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "No se pudo subir la imagen");
      setUrl(data.url);
      onValueChange?.(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-black/10 p-4">
      <p className="text-sm font-semibold text-brand-ink">{label}</p>
      <p className="mt-0.5 text-xs text-brand-muted">{hint}</p>
      <input type="hidden" name={name} value={url} />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex min-h-16 min-w-32 items-center justify-center rounded-lg border border-dashed border-black/15 bg-brand-soft/40 p-3">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={label} className={`${previewClass} w-auto max-w-48 object-contain`} />
          ) : (
            <span className="text-xs text-brand-muted">Sin imagen</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">
            {busy ? "Subiendo…" : url ? "Cambiar imagen" : "Subir imagen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {url && (
            <button type="button" onClick={() => {
                setUrl("");
                onValueChange?.("");
              }} className="cursor-pointer text-xs text-brand-muted hover:text-red-600">
              Quitar (usar el original)
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {url !== initialUrl && <p className="mt-2 text-xs text-brand-muted">Se aplica cuando tocás Guardar.</p>}
    </div>
  );
}
