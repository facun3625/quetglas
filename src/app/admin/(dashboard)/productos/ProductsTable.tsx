"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMoney } from "@/lib/currency";
import { bulkProductAction, duplicateProduct, quickUpdateProduct, type BulkAction } from "./actions";
import { useConfirm } from "@/lib/useConfirm";
import { STOCK_MODE_LABEL, stockModeOf, type StockMode } from "@/lib/stockMode";

export type TableProduct = {
  id: string;
  name: string;
  sku: string | null;
  type: "simple" | "variable";
  visibility: "visible" | "draft" | "scheduled" | "expired";
  featured: boolean;
  manageStock: boolean;
  basePrice: number;
  price: number;
  stock: number;
  categoryName: string | null;
  thumb: string | null;
};

type SortHref = { name: string; category: string; price: string; stock: string };

const VISIBILITY: Record<TableProduct["visibility"], { text: string; cls: string }> = {
  visible: { text: "Publicado", cls: "bg-green-50 text-green-700" },
  draft: { text: "Borrador", cls: "bg-gray-100 text-gray-600" },
  scheduled: { text: "Programado", cls: "bg-blue-50 text-blue-700" },
  expired: { text: "Vencido", cls: "bg-amber-50 text-amber-700" },
};

// Edita precio o stock en el lugar: se guarda al salir del campo (o con Enter)
// asTracked: al guardar la cantidad, el producto pasa a "Controlar cantidad" (y se guarda aunque el número no haya cambiado)
function InlineNumber({ productId, field, value, step, disabled, asTracked }: { productId: string; field: "price" | "stock"; value: number; step: string; disabled?: boolean; asTracked?: boolean }) {
  const [text, setText] = useState(String(value));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n) || (n === value && !asTracked)) return setText(String(value));
    if (asTracked && (!Number.isInteger(n) || n < 0)) {
      setState("error");
      setError("Una cantidad entera de 0 en adelante");
      return;
    }
    setState("saving");
    const result = await quickUpdateProduct(productId, asTracked ? { stockMode: "tracked", stock: n } : { [field]: n });
    if (result.ok) {
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
    } else {
      setState("error");
      setError(result.error ?? "No se pudo guardar");
      setText(String(value));
    }
  }
  return (
    <span className="inline-flex flex-col">
      <input
        type="number"
        step={step}
        min={field === "price" ? 0 : undefined}
        value={text}
        disabled={disabled || state === "saving"}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`${field === "price" ? "w-32" : "w-24"} rounded-md border px-2 py-1 text-sm focus:border-brand-pink focus:outline-none ${state === "saved" ? "border-green-400" : state === "error" ? "border-red-400" : "border-black/10"} disabled:bg-gray-50`}
      />
      {state === "error" && <span className="mt-0.5 text-[10px] text-red-600">{error}</span>}
    </span>
  );
}

// Existencia de un producto simple, en el lugar: Hay existencia / No hay existencia / Controlar cantidad (con el número)
function StockCell({ product }: { product: TableProduct }) {
  const router = useRouter();
  const [mode, setMode] = useState<StockMode>(stockModeOf(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: StockMode) {
    if (next === "tracked") {
      setMode("tracked"); // se guarda al escribir la cantidad
      return;
    }
    const previous = mode;
    setMode(next);
    setSaving(true);
    setError(null);
    const result = await quickUpdateProduct(product.id, { stockMode: next });
    setSaving(false);
    if (result.ok) router.refresh();
    else {
      setMode(previous);
      setError(result.error ?? "No se pudo guardar");
    }
  }

  const tone = mode === "available" ? "border-green-200 bg-green-50 text-green-700" : mode === "unavailable" ? "border-red-200 bg-red-50 text-red-700" : "border-black/10 bg-white text-brand-ink";
  return (
    <span className="inline-flex flex-col gap-1">
      <select
        aria-label={`Existencia de ${product.name}`}
        value={mode}
        disabled={saving}
        onChange={(e) => change(e.target.value as StockMode)}
        className={`w-44 cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold focus:border-brand-pink focus:outline-none ${tone}`}
      >
        {(["available", "unavailable", "tracked"] as StockMode[]).map((m) => (
          <option key={m} value={m}>{STOCK_MODE_LABEL[m]}</option>
        ))}
      </select>
      {mode === "tracked" && <InlineNumber productId={product.id} field="stock" value={product.manageStock ? product.stock : 0} step="1" asTracked />}
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}

export function ProductsTable({ products, sortHref, sort, dir, categories }: { products: TableProduct[]; sortHref: SortHref; sort: string; dir: string; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const { formatMoney } = useMoney();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const [message, setMessage] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [percent, setPercent] = useState("");
  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  async function run(action: BulkAction, confirmText?: string) {
    // Rojo y "Eliminar" solo cuando de verdad se borra; para el resto (precios, existencia) el botón dice "Aplicar"
    const destructive = action.type === "delete";
    if (confirmText && !(await confirm({ title: confirmText, danger: destructive, confirmLabel: destructive ? "Eliminar" : "Aplicar" }))) return;
    start(async () => {
      const result = await bulkProductAction([...selected], action);
      setMessage(result.ok ? `Listo: ${result.affected} producto(s) afectado(s).` : result.error ?? "No se pudo aplicar");
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const arrow = (key: string) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");
  const btn = "cursor-pointer rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      {dialog}
      {selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-pink/30 bg-brand-pink/5 p-3 text-sm">
          <span className="font-semibold text-brand-ink">{selected.size} seleccionado(s)</span>
          <button disabled={pending} className={btn} onClick={() => run({ type: "publish" })}>Publicar</button>
          <button disabled={pending} className={btn} onClick={() => run({ type: "draft" })}>Pasar a borrador</button>
          <button disabled={pending} className={btn} onClick={() => run({ type: "feature", value: true })}>Destacar</button>
          <button disabled={pending} className={btn} onClick={() => run({ type: "feature", value: false })}>Quitar destacado</button>
          <button disabled={pending} className={btn} onClick={() => run({ type: "stockMode", mode: "available" }, `¿Marcar ${selected.size} producto(s) con existencia? Dejan de llevar la cuenta de unidades: si tenían una cantidad cargada, se pierde ese número.`)}>Con existencia</button>
          <button disabled={pending} className={btn} onClick={() => run({ type: "stockMode", mode: "unavailable" }, `¿Marcar ${selected.size} producto(s) sin existencia? No se van a poder comprar (en los que llevaban cantidad, queda en 0).`)}>Sin existencia</button>
          <span className="flex items-center gap-1">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs">
              <option value="">Categoría…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button disabled={pending || !categoryId} className={btn} onClick={() => run({ type: "addCategory", categoryId })}>Agregar</button>
            <button disabled={pending || !categoryId} className={btn} onClick={() => run({ type: "removeCategory", categoryId })}>Quitar</button>
          </span>
          <span className="flex items-center gap-1">
            <input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="% precio" className="w-24 rounded-lg border border-black/10 px-2 py-1.5 text-xs" />
            <button disabled={pending || !percent} className={btn} onClick={() => run({ type: "adjustPrice", percent: Number(percent) }, `¿Cambiar el precio de ${selected.size} producto(s) un ${percent}%? También se ajustan sus variantes.`)}>Ajustar precio</button>
          </span>
          <button disabled={pending} className={`${btn} text-red-600`} onClick={() => run({ type: "delete" }, `¿Eliminar ${selected.size} producto(s)? Los pedidos ya hechos conservan su detalle.`)}>Eliminar</button>
          <button className="ml-auto cursor-pointer text-xs text-brand-muted hover:underline" onClick={() => setSelected(new Set())}>Deseleccionar</button>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-brand-ink">{message}</p>}

      <div className="mt-4 rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          {/* Queda fijo pegado al borde de arriba del panel: -top compensa el relleno del contenedor (py-5 / sm:py-8) */}
          <thead className="sticky -top-5 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.08)] sm:-top-8">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)))} aria-label="Seleccionar todos" /></th>
              <th className="px-3 py-3 font-semibold"><Link href={sortHref.name} className="hover:text-brand-pink-dark">Producto{arrow("name")}</Link></th>
              <th className="px-3 py-3 font-semibold"><Link href={sortHref.category} className="hover:text-brand-pink-dark">Categoría{arrow("category")}</Link></th>
              <th className="px-3 py-3 font-semibold"><Link href={sortHref.price} className="hover:text-brand-pink-dark">Precio{arrow("price")}</Link></th>
              <th className="px-3 py-3 font-semibold"><Link href={sortHref.stock} className="hover:text-brand-pink-dark">Stock{arrow("stock")}</Link></th>
              <th className="px-3 py-3 font-semibold">Estado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const vis = VISIBILITY[p.visibility];
              return (
                <tr key={p.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/40">
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Seleccionar ${p.name}`} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      {p.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 shrink-0 rounded-md bg-brand-soft" />
                      )}
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/productos/${p.id}`} className="font-medium text-brand-ink hover:text-brand-pink-dark hover:underline">{p.name}</Link>
                        <span className="block text-xs text-brand-muted">{p.sku ?? "sin SKU"}{p.type === "variable" ? " · variable" : ""}{p.featured ? " · ★ destacado" : ""}</span>
                      </div>
                      <Link href={`/admin/productos/${p.id}`} className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:border-brand-pink hover:text-brand-pink-dark">
                        Editar
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-brand-muted">{p.categoryName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {p.type === "simple" ? <InlineNumber productId={p.id} field="price" value={p.basePrice} step="0.01" /> : <span className="text-brand-pink-dark">desde {formatMoney(p.price)}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {p.type === "simple" ? (
                      <StockCell product={p} />
                    ) : (
                      // Con variantes la existencia se edita en cada variante (dentro del producto)
                      <span title="Se edita en cada variante" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.stock > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{p.stock > 0 ? STOCK_MODE_LABEL.available : STOCK_MODE_LABEL.unavailable}</span>
                    )}
                  </td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${vis.cls}`}>{vis.text}</span></td>
                  <td className="px-3 py-2 text-right">
                    <button
                      disabled={pending}
                      className="cursor-pointer text-xs font-medium text-brand-muted hover:text-brand-pink-dark disabled:opacity-50"
                      onClick={() => start(async () => {
                        const result = await duplicateProduct(p.id);
                        if (result.ok && result.id) router.push(`/admin/productos/${result.id}`);
                        else setMessage(result.error ?? "No se pudo duplicar");
                      })}
                    >
                      Duplicar
                    </button>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-brand-muted">No encontramos productos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
