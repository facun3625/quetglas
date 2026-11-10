"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAttribute } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Alta de un atributo (estilo WordPress): nombre y, si querés, un primer lote de valores. Después se entra al atributo para editarlo.
export function NewAttributeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [terms, setTerms] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="font-semibold text-brand-ink">Agregar atributo</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Nombre</label>
          <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Talle" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Valores (opcional, uno por línea)</label>
          <textarea className={field} rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder={"S\nM\nL"} />
          <p className="mt-1 text-xs text-brand-muted">Para un color: <code>Rojo|#ff0000</code>. Los valores también se agregan después.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createAttribute({ name, terms });
              if (!r.ok) return setError(r.error);
              router.push(`/admin/atributos/${r.id}`);
            })
          }
          className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear atributo"}
        </button>
      </div>
    </div>
  );
}
