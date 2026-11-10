"use client";

import { useState } from "react";
import { CouponFields, type CouponDefaults } from "./CouponFields";
import { updateCoupon } from "./actions";
import { KIND_LABEL, STATUS_LABEL, type CouponKind, type CouponStatus } from "./couponStatus";

export type CouponListItem = { coupon: CouponDefaults & { id: string }; kind: CouponKind; status: CouponStatus };

const chip = "cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
const chipOn = "border-brand-pink bg-brand-pink text-white";
const chipOff = "border-black/10 text-brand-ink hover:bg-brand-soft";

// Listado de cupones con filtros por tipo (rápido / bienvenida / normal / canje) y por estado (activo, usado, vencido,
// deshabilitado), con la cantidad de cada uno. lockedKind fija el tipo cuando el listado vive dentro de una sección que
// ya es de un solo tipo (los cupones rápidos).
export function CouponsList({ items, categories, lockedKind }: { items: CouponListItem[]; categories: { id: string; name: string }[]; lockedKind?: CouponKind }) {
  const [kind, setKind] = useState<CouponKind | "all">(lockedKind ?? "all");
  const [status, setStatus] = useState<CouponStatus | "all">("all");

  const visible = items.filter((i) => (kind === "all" || i.kind === kind) && (status === "all" || i.status === status));
  // Los números de cada estado respetan el tipo elegido, así lo que dice el botón es lo que se ve al tocarlo
  const statusCounts = (s: CouponStatus | "all") =>
    items.filter((i) => (kind === "all" || i.kind === kind) && (s === "all" || i.status === s)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!lockedKind && (
          <div className="flex flex-wrap gap-1.5">
            {(["all", "quick", "welcome", "regular", "points"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`${chip} ${kind === k ? chipOn : chipOff}`}>
                {k === "all" ? "Todos los tipos" : KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "used", "expired", "disabled"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={`${chip} ${status === s ? chipOn : chipOff}`}>
              {s === "all" ? "Todos" : STATUS_LABEL[s]} <span className="opacity-70">{statusCounts(s)}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.map(({ coupon, kind: k, status: st }) => (
        <form
          key={coupon.id}
          action={updateCoupon}
          className={`rounded-xl border bg-white p-5 transition-colors ${st === "active" ? "border-brand-pink/30" : "border-black/10"}`}
        >
          <input type="hidden" name="id" value={coupon.id} />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${k === "quick" ? "bg-brand-pink/10 text-brand-pink-dark" : "bg-brand-soft text-brand-muted"}`}>
              {KIND_LABEL[k]}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st === "active" ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABEL[st]}
            </span>
          </div>
          <CouponFields defaults={coupon} categories={categories} submitLabel="Guardar" couponId={coupon.id} />
        </form>
      ))}

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
          {items.length === 0 ? "Todavía no hay cupones." : "Ningún cupón coincide con esos filtros."}
        </p>
      )}
    </div>
  );
}
