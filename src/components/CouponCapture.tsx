"use client";

import { useEffect, useState } from "react";

export const COUPON_STORAGE_KEY = "cortopassi_coupon";

// Si alguien llega con ?cupon=CODIGO (por ejemplo, escaneando un QR del local), el código se guarda en el
// navegador y el checkout lo aplica solo. Se avisa con un cartel chico.
export function CouponCapture() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("cupon")?.trim().toUpperCase();
    if (!raw || !/^[A-Z0-9_-]{2,40}$/.test(raw)) return;
    try {
      localStorage.setItem(COUPON_STORAGE_KEY, raw);
    } catch {
      /* sin almacenamiento: el cartel igual avisa */
    }
    setCode(raw);
    const timer = setTimeout(() => setCode(null), 8000);
    return () => clearTimeout(timer);
  }, []);
  if (!code) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-center text-sm text-green-800 shadow-lg">
      Cupón <b>{code}</b> guardado: se aplica al finalizar tu compra.
    </div>
  );
}
