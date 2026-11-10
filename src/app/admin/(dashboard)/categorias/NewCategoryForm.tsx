"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategory } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

export function NewCategoryForm({ options }: { options: { id: string; label: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="font-semibold text-brand-ink">Agregar categoría</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Nombre</label>
          <input className={field} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Disfraces" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Categoría padre</label>
          <select className={`${field} bg-white`} value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Ninguna (nivel superior)</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createCategory({ name, parentId });
              if (!r.ok) return setError(r.error);
              router.push(`/admin/categorias/${r.id}`);
            })
          }
          className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear categoría"}
        </button>
        <p className="text-xs text-brand-muted">Al crearla te lleva a su pantalla para completar imagen, descripción y SEO.</p>
      </div>
    </div>
  );
}
