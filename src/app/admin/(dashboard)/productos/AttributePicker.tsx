"use client";

import { useMemo, useState } from "react";

type Attribute = { id: string; name: string; terms: { id: string; name: string }[] };

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Selector de atributos y valores para los productos variables, pensado para listas largas:
//  - en vez de mostrar TODOS los atributos, se agregan de a uno con un buscador;
//  - los valores elegidos se ven como etiquetas que se pueden quitar, y los demás se buscan escribiendo (máx. 30 resultados);
//  - "Agregar todos" / "Quitar todos" para no tildar de a uno.
export function AttributePicker({
  attributes,
  selectedIds,
  chosen,
  onAddAttribute,
  onRemoveAttribute,
  onToggleTerm,
  onSetTerms,
}: {
  attributes: Attribute[];
  selectedIds: string[];
  chosen: Record<string, Set<string>>;
  onAddAttribute: (id: string) => void;
  onRemoveAttribute: (id: string) => void;
  onToggleTerm: (attrId: string, termId: string) => void;
  onSetTerms: (attrId: string, termIds: string[]) => void;
}) {
  const [attrQuery, setAttrQuery] = useState("");
  const available = useMemo(
    () => attributes.filter((a) => !selectedIds.includes(a.id) && a.name.toLowerCase().includes(attrQuery.trim().toLowerCase())),
    [attributes, selectedIds, attrQuery]
  );

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.map((id) => {
        const attr = attributes.find((a) => a.id === id);
        if (!attr) return null;
        return <AttributeCard key={id} attr={attr} selected={chosen[id] ?? new Set()} onRemove={() => onRemoveAttribute(id)} onToggle={(t) => onToggleTerm(id, t)} onSet={(ids) => onSetTerms(id, ids)} />;
      })}

      {selectedIds.length === 0 && <p className="text-sm text-brand-muted">Todavía no elegiste ningún atributo. Agregá uno (por ejemplo Talle o Color).</p>}

      {attributes.length > selectedIds.length && (
        <div className="rounded-lg border border-dashed border-black/20 p-3">
          <p className="text-xs font-medium text-brand-muted">Agregar un atributo</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {attributes.length > 8 && <input className={`${field} max-w-xs`} value={attrQuery} onChange={(e) => setAttrQuery(e.target.value)} placeholder="Buscar atributo…" />}
            <select
              className={`${field} max-w-xs bg-white`}
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onAddAttribute(e.target.value);
                  setAttrQuery("");
                }
              }}
            >
              <option value="">{available.length === 0 ? "Ningún atributo coincide" : "Elegir atributo…"}</option>
              {available.slice(0, 100).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.terms.length})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function AttributeCard({
  attr,
  selected,
  onRemove,
  onToggle,
  onSet,
}: {
  attr: Attribute;
  selected: Set<string>;
  onRemove: () => void;
  onToggle: (termId: string) => void;
  onSet: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosenTerms = attr.terms.filter((t) => selected.has(t.id));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return attr.terms.filter((t) => !selected.has(t.id) && (!q || t.name.toLowerCase().includes(q)));
  }, [attr.terms, selected, query]);

  return (
    <div className="rounded-lg border border-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brand-ink">
          {attr.name} <span className="font-normal text-brand-muted">· {chosenTerms.length} de {attr.terms.length} valores</span>
        </p>
        <button type="button" onClick={onRemove} className="cursor-pointer text-xs text-red-600 hover:underline">Quitar atributo</button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {chosenTerms.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-brand-pink/10 px-2.5 py-1 text-xs font-medium text-brand-pink-dark">
            {t.name}
            <button type="button" onClick={() => onToggle(t.id)} aria-label={`Quitar ${t.name}`} className="cursor-pointer leading-none hover:text-red-600">×</button>
          </span>
        ))}
        {chosenTerms.length === 0 && <span className="text-xs text-brand-muted">Ningún valor elegido todavía.</span>}
      </div>

      <div className="relative mt-3">
        <input
          className={field}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={`Buscar y agregar valores de ${attr.name}…`}
        />
        {open && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-black/10 bg-white py-1 text-sm shadow-lg">
            {matches.slice(0, 30).map((t) => (
              <li key={t.id}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); onToggle(t.id); }} className="block w-full cursor-pointer px-3 py-1.5 text-left hover:bg-brand-soft">
                  {t.name}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-2 text-xs text-brand-muted">{query ? "Ningún valor coincide." : "No quedan más valores."}</li>}
            {matches.length > 30 && <li className="px-3 py-1.5 text-xs text-brand-muted">Hay {matches.length - 30} más: seguí escribiendo para filtrar.</li>}
          </ul>
        )}
      </div>

      <div className="mt-2 flex gap-3 text-xs">
        <button type="button" onClick={() => onSet(attr.terms.map((t) => t.id))} className="cursor-pointer font-semibold text-brand-pink-dark hover:underline">Agregar todos</button>
        <button type="button" onClick={() => onSet([])} className="cursor-pointer text-brand-muted hover:underline">Quitar todos</button>
      </div>
    </div>
  );
}
