"use client";

import { createContext, useContext } from "react";
import { useMoney } from "@/lib/currency";
import { DEFAULT_PRODUCT_DISPLAY, discountPct, notesFor, type ProductDisplay } from "@/lib/productDisplay";

// Etiqueta de descuento y leyendas de precio (cuotas, texto libre) que se configuran en Configuración → Productos.

const ProductDisplayContext = createContext<ProductDisplay>(DEFAULT_PRODUCT_DISPLAY);

export function ProductDisplayProvider({ value, children }: { value: ProductDisplay; children: React.ReactNode }) {
  return <ProductDisplayContext.Provider value={value}>{children}</ProductDisplayContext.Provider>;
}

export function DiscountBadge({ price, compareAtPrice, size = "sm" }: { price: number; compareAtPrice: number | null; size?: "sm" | "lg" }) {
  const { discountBadge } = useContext(ProductDisplayContext);
  const pct = discountPct(price, compareAtPrice);
  if (!discountBadge.enabled || pct <= 0) return null;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-extrabold uppercase leading-none ${size === "lg" ? "text-sm" : "text-[11px]"}`}
      style={{ backgroundColor: discountBadge.bg, color: discountBadge.color }}
    >
      {discountBadge.text.replace("{pct}", String(pct))}
    </span>
  );
}

export function PriceNotes({ price, where }: { price: number; where: "card" | "product" }) {
  const display = useContext(ProductDisplayContext);
  const { formatMoney } = useMoney();
  const notes = notesFor(display, price, where);
  if (!notes.length) return null;
  const big = where === "product";
  return (
    <div className={`flex flex-col ${big ? "mt-3 gap-1.5" : "mt-1.5 gap-1"}`}>
      {notes.map((n, i) => (
        <p key={i} className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-brand-ink ${big ? "text-sm" : "text-[11px] leading-tight sm:text-xs"}`}>
          {n.installments > 0 && (
            <span className="font-bold">
              {n.installments} x {formatMoney(Math.round((price / n.installments) * 100) / 100)}
            </span>
          )}
          {n.text && <span className={n.installments > 0 ? "text-brand-muted" : "font-semibold"}>{n.text}</span>}
          {n.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.logoUrl} alt="" className={`w-auto object-contain ${big ? "h-6" : "h-4 sm:h-5"}`} loading="lazy" />
          )}
        </p>
      ))}
    </div>
  );
}
