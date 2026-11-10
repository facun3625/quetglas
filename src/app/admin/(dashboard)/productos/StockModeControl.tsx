"use client";

import { useState } from "react";
import { STOCK_MODE_LABEL, stockFieldsFor, stockModeOf, type StockMode } from "@/lib/stockMode";

const MODES: StockMode[] = ["available", "unavailable", "tracked"];

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
// Versión de una sola línea (tabla de variantes): ancho fijo propio, sin el w-full de arriba que se pisaba con el ancho
const compactField = "shrink-0 rounded-lg border border-black/10 px-2 py-1.5 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Selector de existencia de un producto o variante: Hay existencia / No hay existencia / Controlar cantidad (con el número).
// "compact" es la versión de una sola línea para la tabla de variantes.
export function StockModeControl({
  manageStock,
  stock,
  onChange,
  compact = false,
}: {
  manageStock: boolean;
  stock: number;
  onChange: (fields: { manageStock: boolean; stock: number }) => void;
  compact?: boolean;
}) {
  // El estado de la pantalla se guarda aparte: "Controlar cantidad" con 0 unidades sigue mostrando el número para escribirlo
  const [mode, setMode] = useState<StockMode>(stockModeOf({ manageStock, stock }));

  function pick(next: StockMode) {
    setMode(next);
    onChange(stockFieldsFor(next, next === "tracked" ? stock : 0));
  }

  const quantity = (
    <input
      type="number"
      step="1"
      min={0}
      aria-label="Cantidad disponible"
      className={compact ? `${compactField} w-16` : `${field} mt-2 w-32`}
      value={stock}
      onChange={(e) => onChange(stockFieldsFor("tracked", Number(e.target.value)))}
    />
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <select aria-label="Existencia" value={mode} onChange={(e) => pick(e.target.value as StockMode)} className={`${compactField} w-[11.5rem]`}>
          {MODES.map((m) => <option key={m} value={m}>{STOCK_MODE_LABEL[m]}</option>)}
        </select>
        {mode === "tracked" && quantity}
      </div>
    );
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Existencia" className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => pick(m)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === m
                ? m === "unavailable"
                  ? "border-red-500 bg-red-500 text-white"
                  : "border-brand-pink bg-brand-pink text-white"
                : "border-black/10 text-brand-ink hover:bg-brand-soft"
            }`}
          >
            {STOCK_MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {mode === "tracked" && quantity}
      <p className="mt-1.5 text-[11px] text-brand-muted">
        {mode === "available" && "Siempre se puede comprar; no se lleva la cuenta de unidades."}
        {mode === "unavailable" && "No se puede comprar: en la tienda figura “Sin stock” con el aviso de reposición."}
        {mode === "tracked" && "Cada venta descuenta unidades; con 0 queda sin existencia."}
      </p>
    </div>
  );
}
