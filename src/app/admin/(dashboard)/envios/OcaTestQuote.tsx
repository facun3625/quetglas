"use client";

import { useState, useTransition } from "react";
import { testOcaQuote } from "./actions";

export function OcaTestQuote() {
  const [zip, setZip] = useState("");
  const [weight, setWeight] = useState("1");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const field = "rounded-lg border border-black/10 px-3 py-2 text-sm focus:border-brand-pink focus:outline-none";

  return (
    <div className="mt-4 rounded-lg border border-black/10 bg-brand-soft/40 p-4">
      <p className="mb-2 text-sm font-semibold text-brand-ink">Probar cotización</p>
      <p className="mb-3 text-xs text-brand-muted">Guardá la configuración primero. Consulta a OCA con tus datos para verificar que todo esté bien.</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">CP destino</label>
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="2000" className={`${field} w-28`} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Peso (kg)</label>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} className={`${field} w-24`} />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setResult(await testOcaQuote(zip, Number(weight.replace(",", ".")))))}
          className="cursor-pointer rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {pending ? "Consultando…" : "Cotizar"}
        </button>
      </div>
      {result && <p className={`mt-3 text-sm ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.message}</p>}
    </div>
  );
}
