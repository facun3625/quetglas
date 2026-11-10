"use client";

import { instantToDay } from "@/lib/storeTime";
import { useState } from "react";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { Badge } from "@/components/admin/Badge";
import { SaveButton } from "@/components/admin/SaveButton";
import { useFormDirty } from "@/lib/useFormDirty";
import { deleteCoupon } from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";
const sectionLabelClasses = "mb-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted/80";

// Copia local (no lib/sales, que importa Prisma — no se puede usar desde un
// client component) de las etiquetas de medios de pago.
const PAYMENT_METHOD_LABELS = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  contra_entrega: "Contra entrega",
  payway: "Tarjeta (Payway)",
} as const;
const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as (keyof typeof PAYMENT_METHOD_LABELS)[];

const toDateInputValue = instantToDay;

export type CouponDefaults = {
  code: string;
  enabled: boolean;
  discountType: string;
  discountValue: number;
  categoryId: string | null;
  productId: string | null;
  paymentMethod: string | null;
  minPurchaseAmount: number | null;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxUses: number | null;
  oneUsePerCustomer: boolean;
  usedCount: number;
};

export function CouponFields({
  defaults,
  categories,
  submitLabel,
  couponId,
}: {
  defaults: CouponDefaults | null;
  categories: { id: string; name: string }[];
  submitLabel: string;
  couponId?: string;
}) {
  // Los cupones existentes arrancan colapsados (solo la línea de resumen);
  // el form de "Nuevo cupón" siempre va expandido, no tiene nada que ocultar.
  const [open, setOpen] = useState(!couponId);
  const { ref: saveIconRef, dirty, pending: saveIconPending, justSaved: saveIconJustSaved } = useFormDirty<HTMLButtonElement>();
  const saveIconHighlight = !couponId || dirty;

  const usageBadge = defaults
    ? defaults.maxUses
      ? `${defaults.usedCount} / ${defaults.maxUses} usos`
      : `${defaults.usedCount} usos`
    : null;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-40">
            <label className={labelClasses}>Código</label>
            <input
              type="text"
              name="code"
              required
              defaultValue={defaults?.code ?? ""}
              placeholder="VERANO10"
              className={`${fieldClasses} uppercase`}
            />
          </div>

          <div className="w-32">
            <label className={labelClasses}>Tipo</label>
            <select
              name="discountType"
              defaultValue={defaults?.discountType ?? "percentage"}
              className={`${fieldClasses} bg-white`}
            >
              <option value="percentage">% off</option>
              <option value="fixed">$ off</option>
              <option value="free_shipping">Envío gratis</option>
            </select>
          </div>

          <div className="w-28">
            <label className={labelClasses}>Valor</label>
            <input
              type="number"
              name="discountValue"
              min={0}
              step={0.01}
              placeholder="No aplica al envío gratis"
              defaultValue={defaults?.discountValue ? defaults.discountValue : ""}
              className={fieldClasses}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-5">
          {usageBadge && <Badge tone="neutral">{usageBadge}</Badge>}
          <div className="flex items-center gap-2">
            <ToggleSwitch name="enabled" defaultChecked={defaults?.enabled ?? true} />
            <span className="text-sm text-brand-ink">Habilitado</span>
          </div>

          {couponId && (
            <>
              {saveIconJustSaved && <span className="text-xs font-semibold text-green-700">Guardado ✓</span>}
              <button
                ref={saveIconRef}
                type="submit"
                disabled={saveIconPending}
                title={saveIconPending ? "Guardando..." : "Guardar"}
                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-wait ${
                  saveIconJustSaved
                    ? "bg-green-50 text-green-600"
                    : saveIconHighlight
                      ? "bg-brand-pink/10 text-brand-pink-dark hover:bg-brand-pink/20"
                      : "text-brand-muted/40 hover:bg-brand-soft hover:text-brand-pink-dark"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Ocultar detalles" : "Ver detalles"}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-soft hover:text-brand-pink-dark"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="mt-5 border-t border-black/5 pt-4">
            <p className={sectionLabelClasses}>Alcance (opcional)</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-48">
                <label className={labelClasses}>Categoría</label>
                <select name="categoryId" defaultValue={defaults?.categoryId ?? ""} className={`${fieldClasses} bg-white`}>
                  <option value="">Cualquiera</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-40">
                <label className={labelClasses}>ID o SKU de producto</label>
                <input
                  type="text"
                  name="productId"
                  defaultValue={defaults?.productId ?? ""}
                  placeholder="ID o SKU"
                  className={fieldClasses}
                />
              </div>

              <div className="w-44">
                <label className={labelClasses}>Medio de pago</label>
                <select name="paymentMethod" defaultValue={defaults?.paymentMethod ?? ""} className={`${fieldClasses} bg-white`}>
                  <option value="">Cualquiera</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <p className={sectionLabelClasses}>Límites (opcional)</p>
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <label className={labelClasses}>Compra mínima</label>
                <input
                  type="number"
                  name="minPurchaseAmount"
                  min={0}
                  step={0.01}
                  defaultValue={defaults?.minPurchaseAmount ?? ""}
                  className={fieldClasses}
                />
              </div>

              <div className="w-40">
                <label className={labelClasses}>Vigente desde</label>
                <input
                  type="date"
                  name="startsAt"
                  defaultValue={toDateInputValue(defaults?.startsAt ?? null)}
                  className={fieldClasses}
                />
              </div>

              <div className="w-40">
                <label className={labelClasses}>Vence el</label>
                <input
                  type="date"
                  name="expiresAt"
                  defaultValue={toDateInputValue(defaults?.expiresAt ?? null)}
                  className={fieldClasses}
                />
              </div>

              <div className="w-32">
                <label className={labelClasses}>Usos máx.</label>
                <input type="number" name="maxUses" min={1} defaultValue={defaults?.maxUses ?? ""} className={fieldClasses} />
              </div>

              <label className="flex items-center gap-2 pb-2 text-sm text-brand-ink">
                <input type="checkbox" name="oneUsePerCustomer" defaultChecked={defaults?.oneUsePerCustomer ?? false} className="accent-brand-pink" />
                Uso único por cliente
              </label>
            </div>
          </div>

          <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
            <SaveButton label={submitLabel} trackDirty={Boolean(couponId)} />

            {couponId && (
              <a
                href={`/admin/cupones/${couponId}/qr`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-soft"
              >
                Cupón QR
              </a>
            )}

            {couponId && (
              <button
                type="submit"
                formAction={deleteCoupon.bind(null, couponId)}
                className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
              >
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
