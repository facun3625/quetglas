"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCart, cartKey } from "@/lib/cart";
import { useMoney } from "@/lib/currency";
import { CartRecommendations } from "@/components/CartRecommendations";

export function CartDrawer() {
  const { formatMoney } = useMoney();
  const { items, removeItem, setQuantity, total, isOpen, closeCart, keepCartOpen } = useCart();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          <motion.div
            key="panel"
            onPointerDownCapture={keepCartOpen}
            className="fixed right-0 top-0 z-[70] flex h-[100dvh] w-full max-w-[450px] flex-col bg-white shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-4 sm:px-6 sm:py-5">
              <h2 className="text-lg font-bold text-brand-ink">Tu carrito</h2>
              <button
                onClick={closeCart}
                aria-label="Cerrar"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-brand-ink hover:bg-brand-soft"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-brand-muted">Tu carrito está vacío.</p>
                <Link
                  href="/tienda"
                  onClick={closeCart}
                  className="rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark"
                >
                  Ir a la tienda
                </Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4">
                    {items.map((item) => (
                      <div key={cartKey(item)} className="flex items-center gap-3">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 shrink-0 rounded-lg bg-brand-soft" />
                        )}

                        <div className="flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-brand-ink">{item.name}</p>
                          {item.variantLabel && <p className="text-xs text-brand-muted">{item.variantLabel}</p>}
                          <p className="text-sm font-semibold text-brand-pink-dark">
                            {formatMoney(item.price)}
                          </p>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setQuantity(cartKey(item), item.quantity - 1)}
                              className="h-7 w-7 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft"
                              aria-label="Restar"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-sm">{item.quantity}</span>
                            <button
                              onClick={() => setQuantity(cartKey(item), item.quantity + 1)}
                              disabled={item.quantity >= item.maxStock}
                              title={item.quantity >= item.maxStock ? "No hay más stock disponible" : undefined}
                              className="h-7 w-7 cursor-pointer rounded-full border border-black/15 text-brand-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
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
                          className="cursor-pointer text-brand-muted hover:text-red-600"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <CartRecommendations />
                </div>

                <div className="border-t border-black/10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-base font-semibold text-brand-ink">Total</p>
                    <p className="text-base font-bold text-brand-pink-dark">{formatMoney(total)}</p>
                  </div>
                  <Link
                    href="/carrito"
                    onClick={closeCart}
                    className="block w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
                  >
                    Finalizar compra
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
