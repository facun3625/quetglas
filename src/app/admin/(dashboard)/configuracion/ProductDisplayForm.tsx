"use client";

import { useState, useTransition } from "react";
import { useMoney } from "@/lib/currency";
import { MAX_PRICE_NOTES, discountPct, type PriceNote, type ProductDisplay } from "@/lib/productDisplay";
import { saveProductDisplay } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";
const card = "rounded-xl border border-black/10 bg-white p-5";

const NEW_NOTE: PriceNote = { enabled: true, installments: 3, text: "sin interés", logoUrl: "", minPrice: 0, place: "both" };
const EXAMPLE_PRICE = 52097;
const EXAMPLE_BEFORE = 86828.45;

function LogoUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <label className={label}>Logo (opcional)</label>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-8 w-auto max-w-[100px] rounded border border-black/10 object-contain p-0.5" />
        ) : (
          <span className="flex h-8 w-16 items-center justify-center rounded border border-dashed border-black/20 text-[10px] text-brand-muted">sin logo</span>
        )}
        <label className="cursor-pointer rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">
          {busy ? "Subiendo…" : value ? "Cambiar" : "Subir"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setFailed(false);
              const body = new FormData();
              body.set("file", file);
              const res = await fetch("/api/admin/images", { method: "POST", body }).catch(() => null);
              const url = res?.ok ? ((await res.json()) as { url: string }).url : null;
              setBusy(false);
              if (url) onChange(url);
              else setFailed(true);
            }}
          />
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar</button>}
      </div>
      {failed && <p className="mt-1 text-xs text-red-600">No se pudo subir el logo.</p>}
    </div>
  );
}

export function ProductDisplayForm({ initial }: { initial: ProductDisplay }) {
  const { formatMoney } = useMoney();
  const [data, setData] = useState<ProductDisplay>(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const badge = data.discountBadge;
  const setBadge = (patch: Partial<ProductDisplay["discountBadge"]>) => setData((d) => ({ ...d, discountBadge: { ...d.discountBadge, ...patch } }));
  const setNote = (i: number, patch: Partial<PriceNote>) => setData((d) => ({ ...d, notes: d.notes.map((n, k) => (k === i ? { ...n, ...patch } : n)) }));

  function save() {
    setSaved(false);
    start(async () => {
      await saveProductDisplay(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-brand-ink">Etiqueta de descuento</p>
            <p className="mt-1 text-xs text-brand-muted">Se ve arriba del precio en los productos que tienen “precio anterior”. El porcentaje se calcula solo.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-brand-ink">
            <input type="checkbox" checked={badge.enabled} onChange={(e) => setBadge({ enabled: e.target.checked })} className="h-4 w-4 accent-brand-pink" />
            Mostrar
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div>
            <label className={label}>Texto ({"{pct}"} = el porcentaje)</label>
            <input className={field} value={badge.text} maxLength={30} onChange={(e) => setBadge({ text: e.target.value })} placeholder="-{pct}% OFF" />
          </div>
          <div>
            <label className={label}>Fondo</label>
            <input type="color" value={badge.bg} onChange={(e) => setBadge({ bg: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-black/10" />
          </div>
          <div>
            <label className={label}>Texto</label>
            <input type="color" value={badge.color} onChange={(e) => setBadge({ color: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-black/10" />
          </div>
          <div className="pb-1.5">
            <span className="rounded px-1.5 py-0.5 text-xs font-extrabold uppercase" style={{ backgroundColor: badge.bg, color: badge.color }}>
              {(badge.text || "-{pct}% OFF").replace("{pct}", String(discountPct(EXAMPLE_PRICE, EXAMPLE_BEFORE)))}
            </span>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-brand-ink">Leyendas debajo del precio</p>
            <p className="mt-1 text-xs text-brand-muted">
              Cuotas (la cuenta se hace sola con el precio de cada producto) o texto libre, con un logo opcional. Hasta {MAX_PRICE_NOTES}.
            </p>
          </div>
          {data.notes.length < MAX_PRICE_NOTES && (
            <button type="button" onClick={() => setData((d) => ({ ...d, notes: [...d.notes, { ...NEW_NOTE }] }))} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark">
              + Agregar leyenda
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {data.notes.map((n, i) => (
            <div key={i} className={`rounded-lg border border-black/10 p-4 ${n.enabled ? "" : "opacity-60"}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-ink">
                  <input type="checkbox" checked={n.enabled} onChange={(e) => setNote(i, { enabled: e.target.checked })} className="accent-brand-pink" />
                  Leyenda {i + 1}
                </label>
                <button type="button" onClick={() => setData((d) => ({ ...d, notes: d.notes.filter((_, k) => k !== i) }))} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className={label}>Tipo</label>
                  <select className={field} value={n.installments > 0 ? "cuotas" : "texto"} onChange={(e) => setNote(i, e.target.value === "cuotas" ? { installments: n.installments || 3 } : { installments: 0 })}>
                    <option value="cuotas">Cuotas</option>
                    <option value="texto">Texto libre</option>
                  </select>
                </div>
                {n.installments > 0 && (
                  <div>
                    <label className={label}>Cantidad de cuotas</label>
                    <input type="number" min={2} max={24} className={field} value={n.installments} onChange={(e) => setNote(i, { installments: Math.min(24, Math.max(2, Number(e.target.value) || 2)) })} />
                  </div>
                )}
                <div>
                  <label className={label}>{n.installments > 0 ? "Texto después del monto" : "Texto"}</label>
                  <input className={field} value={n.text} maxLength={60} onChange={(e) => setNote(i, { text: e.target.value })} placeholder={n.installments > 0 ? "sin interés / con" : "Envío gratis"} />
                </div>
                <LogoUpload value={n.logoUrl} onChange={(url) => setNote(i, { logoUrl: url })} />
                <div>
                  <label className={label}>Solo desde este precio (0 = siempre)</label>
                  <input type="number" min={0} className={field} value={n.minPrice} onChange={(e) => setNote(i, { minPrice: Math.max(0, Number(e.target.value) || 0) })} />
                </div>
                <div>
                  <label className={label}>Dónde se ve</label>
                  <select className={field} value={n.place} onChange={(e) => setNote(i, { place: e.target.value as PriceNote["place"] })}>
                    <option value="both">Tarjetas y página del producto</option>
                    <option value="card">Solo en las tarjetas</option>
                    <option value="product">Solo en la página del producto</option>
                  </select>
                </div>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded bg-brand-soft px-3 py-2 text-xs text-brand-ink">
                <span className="text-brand-muted">Así se ve con {formatMoney(EXAMPLE_PRICE)}:</span>
                {n.installments > 0 && <b>{n.installments} x {formatMoney(Math.round((EXAMPLE_PRICE / n.installments) * 100) / 100)}</b>}
                {n.text && <span>{n.text}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {n.logoUrl && <img src={n.logoUrl} alt="" className="h-5 w-auto object-contain" />}
              </p>
            </div>
          ))}
          {data.notes.length === 0 && <p className="text-sm text-brand-muted">Todavía no hay leyendas. Ej.: “3 x $17.365,67 sin interés” con el logo de Mercado Pago.</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled={pending} onClick={save} className="cursor-pointer rounded-lg bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="rounded-lg bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">✓ Guardado</span>}
      </div>
    </div>
  );
}
