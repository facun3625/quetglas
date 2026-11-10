"use client";

import { useState, useTransition } from "react";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { setPaymentMethodEnabled } from "@/app/admin/(dashboard)/pagos/actions";

// Switch de activar/desactivar un medio de pago que guarda solo al instante
// (no depende del botón "Guardar" del form). Optimista: cambia en pantalla al
// toque y revierte si el server falla.
export function PaymentEnabledToggle({ method, enabled }: { method: PaymentMethod; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      try {
        await setPaymentMethodEnabled(method, next);
      } catch {
        setOn(!next);
      }
    });
  }

  return (
    <label
      className="relative inline-flex shrink-0 cursor-pointer items-center"
      title={on ? "Activado — clic para desactivar" : "Desactivado — clic para activar"}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={toggle}
        disabled={pending}
        className="peer sr-only"
      />
      <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand-pink peer-disabled:opacity-60" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
    </label>
  );
}
