"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/enums";
import { orderStatusLabel, paymentMethodLabel } from "@/lib/orderLabels";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];
const PAYMENTS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];

// Buscador (texto) + filtros por medio de pago y estado. Todo va por la URL
// (?q=&payment=&status=&from=&to=), reseteando la paginación en cada cambio.
export function SalesFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  function apply(next: { q?: string; payment?: string; status?: string; from?: string; to?: string }) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    sp.delete("page");
    router.push(`/admin/ventas?${sp.toString()}`);
  }

  // Búsqueda por texto con debounce.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const handle = setTimeout(() => apply({ q: q.trim() }), 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const selectClass =
    "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, email o teléfono..."
        className="min-w-[220px] flex-1 rounded-lg border border-black/10 px-3.5 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
      />
      <select
        value={params.get("payment") ?? ""}
        onChange={(e) => apply({ payment: e.target.value })}
        className={selectClass}
      >
        <option value="">Todos los pagos</option>
        {PAYMENTS.map((p) => (
          <option key={p} value={p}>
            {paymentMethodLabel(p)}
          </option>
        ))}
      </select>
      <select
        value={params.get("status") ?? ""}
        onChange={(e) => apply({ status: e.target.value })}
        className={selectClass}
      >
        <option value="">Todos los estados</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {orderStatusLabel(s)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-brand-muted">
        Desde
        <input
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => apply({ from: e.target.value })}
          className={selectClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-brand-muted">
        Hasta
        <input
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => apply({ to: e.target.value })}
          className={selectClass}
        />
      </label>
    </div>
  );
}
