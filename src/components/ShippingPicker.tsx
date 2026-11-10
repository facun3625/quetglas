"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMoney } from "@/lib/currency";
import { PROVINCES } from "@/lib/provinces";
import type { ShippingOptionsResult, ShippingOption } from "@/lib/shippingFlow";

// Envío del checkout: código postal -> opciones (OCA a domicilio / a sucursal, métodos propios, a acordar)
// con las restricciones y descuentos de la zona. Es solo lo que se muestra; el servidor recalcula todo al crear el pedido.

export type PickerAddress = { street: string; number: string; apartment: string; city: string; province: string; zipCode: string };
export type ShippingSelection = {
  choice: { code: string; branchId?: string; address?: PickerAddress } | null;
  cost: number;
  baseCost: number;
  isFree: boolean;
  zipDiscount: number;
  blocked: boolean;
  ready: boolean;
  saveAddress: boolean;
};

type Result = ShippingOptionsResult & { contact?: { whatsapp?: string } };
type SavedAddress = PickerAddress & { id: string; isDefault: boolean; apartment: string | null };

const EMPTY: PickerAddress = { street: "", number: "", apartment: "", city: "", province: "", zipCode: "" };
const input = "w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold text-brand-muted";

export function ShippingPicker({
  items,
  paymentMethod,
  couponCode,
  email,
  isLoggedIn,
  onChange,
}: {
  items: { productId: string; variantId: string | null; quantity: number }[];
  paymentMethod: string | null;
  couponCode?: string;
  email?: string;
  isLoggedIn: boolean;
  onChange: (s: ShippingSelection) => void;
}) {
  const { formatMoney } = useMoney();
  const [address, setAddress] = useState<PickerAddress>(EMPTY);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [saveAddress, setSaveAddress] = useState(false);

  const zip = address.zipCode.trim();
  const zipForQuote = zip.length >= 4 ? zip : "";
  const itemsKey = items.map((i) => `${i.productId}:${i.variantId ?? ""}:${i.quantity}`).join(",");
  const requestSeq = useRef(0);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((list: SavedAddress[]) => {
        if (!Array.isArray(list)) return;
        setSaved(list);
        const def = list.find((a) => a.isDefault);
        if (def) setAddress({ street: def.street, number: def.number, apartment: def.apartment ?? "", city: def.city, province: def.province, zipCode: def.zipCode });
      })
      .catch(() => undefined);
  }, [isLoggedIn]);

  // Opciones: se vuelven a pedir al cambiar el código postal, el carrito, el medio de pago o el cupón
  useEffect(() => {
    if (!paymentMethod || items.length === 0) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    setFailed(false);
    const handle = setTimeout(() => {
      fetch("/api/shipping/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: zipForQuote, paymentMethod, couponCode: couponCode || undefined, email: email || undefined, items }),
      })
        .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
        .then(({ ok, body }) => {
          if (seq !== requestSeq.current) return;
          if (!ok) throw new Error();
          setData(body as Result);
        })
        .catch(() => {
          if (seq === requestSeq.current) {
            setData(null);
            setFailed(true);
          }
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    }, 450);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, itemsKey, zipForQuote, couponCode]);

  const options = useMemo(() => data?.options ?? [], [data]);
  const selected: ShippingOption | undefined = options.find((o) => o.code === code) ?? options[0];

  // Si la opción elegida ya no existe (cambió el medio de pago o la zona), se pasa a la primera disponible
  useEffect(() => {
    if (options.length === 0) setCode(null);
    else if (!options.some((o) => o.code === code)) setCode(options[0].code);
  }, [options, code]);

  const branches = selected?.branches ?? [];
  useEffect(() => {
    if (selected?.code !== "oca_sucursal") return;
    if (!branches.some((b) => b.id === branchId)) setBranchId(branches.length === 1 ? branches[0].id : "");
  }, [selected?.code, branches, branchId]);

  const blocked = data?.restriction?.type === "block_sale";
  const free = data?.freeShipping.active ?? false;
  const addressOk = Boolean(address.street.trim() && address.number.trim() && address.city.trim() && address.province && zip.length >= 4);
  const ready = Boolean(
    selected && !blocked && !loading && (!selected.requiresAddress || addressOk) && (selected.code !== "oca_sucursal" || branchId)
  );
  const baseCost = selected?.price ?? 0;
  const cost = free ? 0 : baseCost;
  const zipDiscount = data && zipForQuote === data.zipCode ? (data.zipDiscount?.amount ?? 0) : 0;

  useEffect(() => {
    onChange({
      choice: selected ? { code: selected.code, branchId: branchId || undefined, address: selected.requiresAddress ? address : undefined } : null,
      cost,
      baseCost,
      isFree: free && baseCost > 0,
      zipDiscount,
      blocked: Boolean(blocked),
      ready,
      saveAddress: saveAddress && isLoggedIn && addressOk,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.code, branchId, address, cost, baseCost, free, zipDiscount, blocked, ready, saveAddress]);

  const set = (key: keyof PickerAddress, value: string) => setAddress((a) => ({ ...a, [key]: value }));

  const priceText = (o: ShippingOption) => {
    if (o.price === null) return o.kind === "acordar" ? "A coordinar" : "—";
    if (free && o.price > 0) return <><s className="mr-1 font-normal text-brand-muted">{formatMoney(o.price)}</s>Gratis</>;
    return o.price > 0 ? formatMoney(o.price) : "Gratis";
  };

  const whatsapp = data?.contact?.whatsapp?.replace(/\D/g, "");

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-brand-muted">Envío</p>

      {data?.freeShipping.threshold ? (
        <p className={`rounded-lg px-3 py-2 text-sm ${free ? "bg-green-50 text-green-800" : "bg-brand-soft text-brand-ink"}`}>
          {free ? "🎉 ¡Tu compra tiene envío gratis!" : `Envío gratis en compras desde ${formatMoney(data.freeShipping.threshold)}`}
        </p>
      ) : free ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">🎉 ¡Tu cupón incluye envío gratis!</p>
      ) : null}

      {saved.length > 0 && (
        <div>
          <label className={label}>Mis direcciones guardadas</label>
          <select
            className={input}
            value=""
            onChange={(e) => {
              const a = saved.find((s) => s.id === e.target.value);
              if (a) setAddress({ street: a.street, number: a.number, apartment: a.apartment ?? "", city: a.city, province: a.province, zipCode: a.zipCode });
            }}
          >
            <option value="">Elegir una dirección guardada…</option>
            {saved.map((a) => (
              <option key={a.id} value={a.id}>
                {a.street} {a.number}, {a.city} ({a.zipCode})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="sm:max-w-[220px]">
        <label className={label}>Código postal</label>
        <input
          value={address.zipCode}
          onChange={(e) => set("zipCode", e.target.value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 8))}
          inputMode="numeric"
          placeholder="Ej: 3000"
          className={input}
        />
        <p className="mt-1 text-xs text-brand-muted">Con tu código postal te mostramos cuánto cuesta el envío.</p>
      </div>

      {data?.restriction?.type === "block_sale" && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">No podemos vender a ese código postal</p>
          <p>{data.restriction.message || "Por el momento no realizamos ventas online a esa zona."}</p>
          {data.restriction.address && <p className="mt-1">📍 {data.restriction.address}</p>}
          {data.restriction.phone && <p>📞 {data.restriction.phone}</p>}
        </div>
      )}
      {data?.restriction?.type === "block_shipping" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <p>{data.restriction.message || "No hacemos envíos con correo a tu zona."}</p>
          {data.restriction.address && <p className="mt-1">📍 {data.restriction.address}</p>}
          {data.restriction.phone && <p>📞 {data.restriction.phone}</p>}
        </div>
      )}
      {data?.zipDiscount && zipDiscount > 0 && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          🏷️ {data.zipDiscount.label || "Descuento por tu zona"}: -{formatMoney(zipDiscount)}
        </p>
      )}
      {data?.ocaError && !blocked && <p className="text-xs text-amber-700">No pudimos consultar la tarifa de OCA en este momento: {data.ocaError}</p>}

      {loading && <p className="text-sm text-brand-muted">Calculando opciones de envío…</p>}
      {failed && <p className="text-sm text-red-700">No pudimos cargar las opciones de envío. Probá de nuevo.</p>}

      {!loading && !failed && data && options.length === 0 && !blocked && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No hay métodos de envío disponibles para esta compra.{" "}
          {whatsapp && (
            <a className="font-semibold underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
              Escribinos por WhatsApp
            </a>
          )}
        </p>
      )}

      {!blocked && options.length > 0 && (
        <div className="flex flex-col gap-3">
          {options.map((o) => {
            const isSel = selected?.code === o.code;
            return (
              <div key={o.code} className={`rounded-xl border px-4 py-3.5 text-sm transition-colors ${isSel ? "border-brand-pink bg-brand-pink/5" : "border-black/10 hover:border-black/20"}`}>
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span>
                    <span className="flex items-center gap-2.5">
                      <input type="radio" name="shippingOption" checked={isSel} onChange={() => setCode(o.code)} className="accent-brand-pink" />
                      {o.label}
                    </span>
                    {o.description && <span className="ml-6 block text-xs text-brand-muted">{o.description}</span>}
                    {o.kind === "oca" && o.iva !== undefined && o.priceBeforeTax !== undefined && !free && (
                      <span className="ml-6 block text-xs text-brand-muted">
                        {formatMoney(o.priceBeforeTax)} + IVA {formatMoney(o.iva)}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-brand-ink">{priceText(o)}</span>
                </label>

                {isSel && o.code === "oca_sucursal" && (
                  <div className="mt-4 border-t border-brand-pink/20 pt-4">
                    <label className={label}>Sucursal de OCA donde retirás</label>
                    <select required value={branchId} onChange={(e) => setBranchId(e.target.value)} className={input}>
                      <option value="" disabled>
                        Elegí una sucursal…
                      </option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} — {b.address}, {b.city}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!blocked && selected?.requiresAddress && (
        <div className="grid gap-3 rounded-xl border border-black/10 p-4 sm:grid-cols-6">
          <p className="text-xs font-semibold text-brand-muted sm:col-span-6">
            {selected.code === "oca_sucursal" ? "Tu dirección (para el registro del envío)" : "Dirección de entrega"}
          </p>
          <div className="sm:col-span-4">
            <label className={label}>Calle</label>
            <input required value={address.street} onChange={(e) => set("street", e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Número</label>
            <input required value={address.number} onChange={(e) => set("number", e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Piso / Depto (opcional)</label>
            <input value={address.apartment} onChange={(e) => set("apartment", e.target.value)} placeholder="Ej: 3B" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Ciudad</label>
            <input required value={address.city} onChange={(e) => set("city", e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Provincia</label>
            <select required value={address.province} onChange={(e) => set("province", e.target.value)} className={input}>
              <option value="" disabled>
                Elegir…
              </option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {isLoggedIn && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-brand-muted sm:col-span-6">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-brand-pink" />
              Guardar esta dirección para próximas compras
            </label>
          )}
        </div>
      )}
    </div>
  );
}
