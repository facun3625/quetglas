"use client";

import { useEffect, useRef, useState } from "react";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Etiquetas: se escriben y se confirman con Enter o coma; se sugieren las ya existentes
export function TagsInput({ tags, onChange, suggestions }: { tags: string[]; onChange: (tags: string[]) => void; suggestions: string[] }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const name = raw.trim();
    if (name && !tags.some((t) => t.toLowerCase() === name.toLowerCase())) onChange([...tags, name]);
    setText("");
  };
  const available = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()) && (!text || s.toLowerCase().includes(text.toLowerCase()))).slice(0, 8);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink">
            {t}
            <button type="button" aria-label={`Quitar ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="cursor-pointer text-brand-muted hover:text-red-600">✕</button>
          </span>
        ))}
      </div>
      <input
        className={field}
        value={text}
        placeholder="Escribí una etiqueta y apretá Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      {available.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="text-brand-muted">Existentes:</span>
          {available.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="cursor-pointer rounded-full border border-black/10 px-2.5 py-0.5 text-brand-ink hover:bg-brand-soft">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

type Found = { id: string; name: string; sku: string | null };

// Buscador de productos para elegir los recomendados
export function RelatedPicker({ value, onChange, selfId, initialNames }: { value: string[]; onChange: (ids: string[]) => void; selfId?: string; initialNames: Record<string, string> }) {
  const [names, setNames] = useState<Record<string, string>>(initialNames);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) setResults(((await res.json()) as { products: Found[] }).products.filter((p) => p.id !== selfId && !value.includes(p.id)));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, selfId, value]);

  return (
    <div>
      <ul className="mb-2 space-y-1">
        {value.map((id) => (
          <li key={id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-1.5 text-sm">
            <span className="text-brand-ink">{names[id] ?? id}</span>
            <button type="button" aria-label="Quitar" onClick={() => onChange(value.filter((x) => x !== id))} className="cursor-pointer text-brand-muted hover:text-red-600">✕</button>
          </li>
        ))}
      </ul>
      <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un producto por nombre o SKU…" />
      {q.trim().length >= 2 && results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-auto rounded-lg border border-black/10 bg-white text-sm shadow">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="block w-full cursor-pointer px-3 py-2 text-left hover:bg-brand-soft"
                onClick={() => {
                  setNames((n) => ({ ...n, [p.id]: p.name }));
                  onChange([...value, p.id]);
                  setQ("");
                  setResults([]);
                }}
              >
                {p.name}{p.sku ? <span className="text-xs text-brand-muted"> · {p.sku}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
