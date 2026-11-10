"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; street: string; number: string; apartment: string | null; city: string; province: string; zipCode: string; isDefault: boolean };

export function AddressList({ addresses }: { addresses: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(id: string, method: "DELETE" | "PATCH") {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, { method });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("No se pudo completar la acción. Probá de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {addresses.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-brand-ink">
              {a.street} {a.number}
              {a.apartment ? `, ${a.apartment}` : ""}
              {a.isDefault && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-pink-dark">Predeterminada</span>}
            </p>
            <p className="text-xs text-brand-muted">
              {a.city}, {a.province} · CP {a.zipCode}
            </p>
          </div>
          <div className="flex gap-3 text-xs font-semibold">
            {!a.isDefault && (
              <button disabled={busy === a.id} onClick={() => void call(a.id, "PATCH")} className="cursor-pointer text-brand-pink-dark hover:underline disabled:opacity-50">
                Usar como predeterminada
              </button>
            )}
            <button disabled={busy === a.id} onClick={() => void call(a.id, "DELETE")} className="cursor-pointer text-brand-muted hover:text-red-700 disabled:opacity-50">
              Borrar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
