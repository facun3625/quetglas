"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/lib/cart";
import { isLikelyPhone } from "@/lib/whatsapp";

export function CartRecoveryPrompt() {
  const { recoveryPromptOpen, saveRecoveryPhone, dismissRecoveryPrompt } = useCart();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recoveryPromptOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissRecoveryPrompt();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [recoveryPromptOpen, dismissRecoveryPrompt]);

  return (
    <AnimatePresence>
      {recoveryPromptOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Cerrar"
            className="fixed inset-0 z-[80] cursor-default bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissRecoveryPrompt}
          />
          <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-recovery-title"
              className="pointer-events-auto relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
            >
            <button
              type="button"
              onClick={dismissRecoveryPrompt}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-brand-muted hover:bg-brand-soft hover:text-brand-ink"
            >
              <span aria-hidden="true" className="text-xl leading-none">×</span>
            </button>

            <h2 id="cart-recovery-title" className="pr-10 text-xl font-bold text-brand-ink">
              ¿Querés guardar tu carrito?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">
              Dejanos tu WhatsApp y te ayudamos a retomarlo si no terminás la compra.
            </p>

            <form
              className="mt-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!isLikelyPhone(phone)) {
                  setError("Ingresá un número válido, con código de área.");
                  return;
                }
                saveRecoveryPhone(phone);
              }}
            >
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                maxLength={30}
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setError(null);
                }}
                placeholder="Ej.: 342 555 1234"
                aria-label="Número de WhatsApp"
                aria-describedby="cart-recovery-note"
                className="min-h-11 w-full rounded-full border border-black/10 px-4 text-sm text-brand-ink outline-none focus:border-brand-pink"
              />
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              <button
                type="submit"
                className="mt-3 min-h-11 w-full cursor-pointer rounded-full bg-brand-pink px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
              >
                Guardar y seguir
              </button>
            </form>

            <p id="cart-recovery-note" className="mt-3 text-center text-xs text-brand-muted">
              Sólo lo usaremos para recuperar este carrito. No te suscribe a campañas.
            </p>
            <button
              type="button"
              onClick={dismissRecoveryPrompt}
              className="mt-3 min-h-10 w-full cursor-pointer rounded-full border border-black/10 bg-brand-soft/40 px-5 text-center text-sm font-semibold text-brand-muted transition-colors hover:border-black/20 hover:bg-brand-soft hover:text-brand-ink"
            >
              Ahora no, seguir comprando
            </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
