"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCart, cartKey } from "@/lib/cart";
import { useMoney } from "@/lib/currency";
import { CheckoutForm } from "@/components/CheckoutForm";

export default function CarritoPage() {
  const { formatMoney } = useMoney();
  const { items, removeItem, setQuantity, total } = useCart();
  const [showCheckout, setShowCheckout] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);

  // Al abrir el checkout, bajar hasta el formulario (si no, queda el botón arriba y parece que no pasó nada).
  // Se anima a mano y el destino se recalcula en cada cuadro: al scrollear, el encabezado puede cambiar de alto y correr
  // la página, y el scroll suave del navegador se cortaría a mitad de camino.
  useEffect(() => {
    if (!showCheckout) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 500;
    const startY = window.scrollY;
    const target = () => {
      const el = checkoutRef.current;
      if (!el) return startY;
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      return Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 16);
    };
    let frame = 0;
    let begin: number | null = null;
    const step = (now: number) => {
      begin ??= now;
      const t = duration === 0 ? 1 : Math.min(1, (now - begin) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo({ top: startY + (target() - startY) * eased, behavior: "instant" });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [showCheckout]);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Tu carrito está vacío</h1>
        <p className="mt-2 text-brand-muted">Todavía no agregaste productos.</p>
        <Link
          href="/tienda"
          className="mt-6 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12 lg:max-w-5xl">
      <h1 className="text-2xl font-bold text-brand-ink">Tu carrito</h1>

      <div className="mt-8 flex flex-col gap-4">
        {items.map((item) => (
          <div
            key={cartKey(item)}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 sm:flex sm:gap-4 sm:p-4"
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image}
                alt={item.name}
                className="h-16 w-16 shrink-0 rounded-xl object-cover sm:h-20 sm:w-20"
              />
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-xl bg-brand-soft sm:h-20 sm:w-20" />
            )}

            <div className="flex-1">
              <p className="text-sm font-medium text-brand-ink">{item.name}</p>
                          {item.variantLabel && <p className="text-xs text-brand-muted">{item.variantLabel}</p>}
              <p className="text-sm font-semibold text-brand-pink-dark">{formatMoney(item.price)}</p>
            </div>

            <div className="col-span-2 col-start-2 flex flex-col items-start gap-1 sm:col-auto sm:items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(cartKey(item), item.quantity - 1)}
                  className="h-10 w-10 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft sm:h-8 sm:w-8"
                  aria-label="Restar"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => setQuantity(cartKey(item), item.quantity + 1)}
                  disabled={item.quantity >= item.maxStock}
                  title={item.quantity >= item.maxStock ? "No hay más stock disponible" : undefined}
                  className="h-10 w-10 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent sm:h-8 sm:w-8"
                  aria-label="Sumar"
                >
                  +
                </button>
              </div>
              {item.quantity >= item.maxStock && (
                <span className="text-[10px] text-brand-muted">Stock máx.</span>
              )}
            </div>

            <button
              onClick={() => removeItem(cartKey(item))}
              aria-label="Quitar"
              className="row-start-1 flex h-10 w-10 items-center justify-center justify-self-end cursor-pointer text-brand-muted hover:text-red-600 sm:ml-2 sm:h-auto sm:w-auto"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-6">
        <p className="text-lg font-semibold text-brand-ink">Total</p>
        <p className="text-lg font-bold text-brand-pink-dark">{formatMoney(total)}</p>
      </div>

      {showCheckout ? (
        <div ref={checkoutRef}>
          <CheckoutForm />
        </div>
      ) : (
        <button
          onClick={() => setShowCheckout(true)}
          className="mt-6 w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
        >
          Finalizar compra
        </button>
      )}
    </div>
  );
}
