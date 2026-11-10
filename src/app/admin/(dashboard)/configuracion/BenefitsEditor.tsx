"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BENEFIT_ICONS, MAX_BENEFITS, resolveBenefitIcon, type HomeBenefit } from "@/lib/benefitIcons";
import { saveHomeBenefits } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function IconGrid({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => {
    const terms = norm(query).split(/\s+/).filter(Boolean);
    return terms.length === 0 ? BENEFIT_ICONS : BENEFIT_ICONS.filter((i) => terms.every((t) => norm(`${i.label} ${i.keywords}`).includes(t)));
  }, [query]);
  const selected = resolveBenefitIcon(value);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-pink-dark"><selected.Icon className="h-5 w-5" /></span>
        <input className={field} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Ícono: ${selected.label} — buscá otro (ej. envío, tarjeta, regalo)`} />
      </div>
      <div className="mt-2 grid max-h-36 grid-cols-8 gap-1 overflow-auto rounded-lg border border-black/10 p-1.5 sm:grid-cols-10">
        {list.map((i) => (
          <button
            key={i.key}
            type="button"
            title={i.label}
            aria-label={i.label}
            aria-pressed={selected.key === i.key}
            onClick={() => onChange(i.key)}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors ${
              selected.key === i.key ? "border-brand-pink bg-brand-soft text-brand-pink-dark" : "border-transparent text-brand-muted hover:border-black/10 hover:text-brand-ink"
            }`}
          >
            <i.Icon className="h-4 w-4" />
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full px-2 py-3 text-xs text-brand-muted">Ningún ícono coincide.</p>}
      </div>
    </div>
  );
}

// Editor de la franja de beneficios: 1 a 6 ítems, cada uno con ícono (librería Lucide, con buscador), título y subtítulo.
export function BenefitsEditor({ initial, hasCustom }: { initial: HomeBenefit[]; hasCustom: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<HomeBenefit[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<HomeBenefit>) => setItems((list) => list.map((b, n) => (n === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) =>
    setItems((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function save(list: HomeBenefit[]) {
    setMsg(null);
    start(async () => {
      const r = await saveHomeBenefits(list);
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
      setTimeout(() => setMsg((m) => (m?.ok ? null : m)), 5000);
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm text-brand-muted">
        Es la franja que se ve debajo del slider del inicio. Podés tener de 1 a {MAX_BENEFITS} ítems, cambiar el ícono, el título y el subtítulo de cada uno,
        agregar nuevos y ordenarlos. Se reparten el ancho (hasta 4 por fila).
      </p>

      {/* Vista previa */}
      <div className="mt-4 rounded-xl border border-black/5 bg-brand-soft/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-muted">Así se ve</p>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((b, i) => {
            const Icon = resolveBenefitIcon(b.icon).Icon;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-pink-dark shadow-sm"><Icon className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-brand-ink">{b.title || <span className="text-brand-muted/60">Título</span>}</p>
                  {b.subtitle && <p className="text-xs leading-snug text-brand-muted">{b.subtitle}</p>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-sm text-brand-muted">Sin ítems: se muestra la franja original.</p>}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {items.map((b, i) => (
          <div key={i} className="rounded-lg border border-black/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-brand-muted">Ítem {i + 1}</p>
              <div className="flex items-center gap-1 text-xs">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="cursor-pointer rounded border border-black/10 px-2 py-1 font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-30">←</button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="cursor-pointer rounded border border-black/10 px-2 py-1 font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-30">→</button>
                <button type="button" onClick={() => setItems((list) => list.filter((_, n) => n !== i))} className="ml-2 cursor-pointer text-red-600 hover:underline">Quitar</button>
              </div>
            </div>
            <IconGrid value={b.icon} onChange={(key) => update(i, { icon: key })} />
            <div className="mt-3 grid gap-3">
              <div><label className={label}>Título</label><input className={field} maxLength={80} value={b.title} onChange={(e) => update(i, { title: e.target.value })} placeholder="Ej.: Envíos a todo el país" /></div>
              <div><label className={label}>Subtítulo</label><input className={field} maxLength={120} value={b.subtitle} onChange={(e) => update(i, { subtitle: e.target.value })} placeholder="Ej.: Rápidos y seguros" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
        {items.length < MAX_BENEFITS && (
          <button type="button" onClick={() => setItems((list) => [...list, { icon: "sparkles", title: "", subtitle: "" }])} className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">
            + Agregar ítem
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => save(items)} className="cursor-pointer rounded-lg bg-brand-pink px-5 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar franja"}
        </button>
        {hasCustom && (
          <button type="button" disabled={pending} onClick={() => save([])} className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-brand-muted hover:text-red-600">
            Volver a la franja original
          </button>
        )}
        {msg && <span className={`rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.ok ? "✓ " : ""}{msg.text}</span>}
      </div>
    </div>
  );
}
