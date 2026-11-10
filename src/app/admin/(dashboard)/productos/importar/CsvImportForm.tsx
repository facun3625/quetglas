"use client";

import { useState, useTransition } from "react";
import { importPriceStockCsv, type CsvImportResult } from "../actions";

export function CsvImportForm() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<CsvImportResult | null>(null);

  return (
    <div>
      <form
        action={(formData) => start(async () => setResult(await importPriceStockCsv(formData)))}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
        <button type="submit" disabled={pending} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>
      {result && !result.ok && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{result.error}</p>}
      {result?.ok && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <p>Se actualizaron {result.updated} producto(s)/variante(s).</p>
          {result.notFound.length > 0 && <p className="mt-1 text-amber-800">SKU no encontrados: {result.notFound.join(", ")}</p>}
          {result.invalid.length > 0 && <p className="mt-1 text-amber-800">Filas con valores inválidos (no se tocaron): {result.invalid.join(", ")}</p>}
        </div>
      )}
    </div>
  );
}
