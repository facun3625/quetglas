"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

// Selector de categorías destacadas: arriba, una lista prolija de las
// elegidas (orden = orden en el home, con flechas arriba/abajo y una × para
// sacar); abajo, un buscador (no un <select>: ícono de lupa + resultados
// filtrados) para agregar del resto. El valor viaja al server action como
// inputs hidden `featuredCategoryIds` — antes eran checkboxes `sr-only`
// dentro de un contenedor con scroll, y al tocarlos el navegador scrolleaba
// hacia el input posicionado fuera de la caja (el "espacio abajo").
export function CategoryChipSelector({
  categories,
  selectedIds,
  name = "featuredCategoryIds",
  emptyText = "Ninguna elegida — se usa la selección por defecto.",
}: {
  categories: { id: string; name: string }[];
  selectedIds: string[];
  name?: string;
  emptyText?: string;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const [selected, setSelected] = useState<string[]>(() => selectedIds.filter((id) => byId.has(id)));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const firstRender = useRef(true);
  const listboxId = useId();

  // Los inputs hidden cambian por estado de React, no por el usuario, así que
  // no disparan eventos solos — avisamos al form para que useFormDirty
  // prenda el botón de Guardar.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    containerRef.current?.dispatchEvent(new Event("change", { bubbles: true }));
  }, [selected]);

  // Al abrir la lista, la página baja lo justo para que se vea entera (si no, queda pegada al borde de abajo)
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = categories
    .filter((c) => !selected.includes(c.id) && c.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 50);

  function add(id: string) {
    setSelected((prev) => [...prev, id]);
    setQuery("");
    setActive(0);
  }

  function remove(id: string) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function move(index: number, delta: number) {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      // Enter nunca manda el form desde el buscador — agrega la sugerencia.
      e.preventDefault();
      const pick = suggestions[active];
      if (open && pick) add(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div ref={containerRef}>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {selected.length > 0 ? (
        <ol className="mb-3 flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/10">
          {selected.map((id, i) => (
            <li key={id} className="flex items-center gap-3 bg-white px-3 py-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-muted">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-brand-ink">{byId.get(id)?.name}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Mover ${byId.get(id)?.name} arriba`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-brand-muted hover:bg-black/5 hover:text-brand-ink disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m18 15-6-6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === selected.length - 1}
                  aria-label={`Mover ${byId.get(id)?.name} abajo`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-brand-muted hover:bg-black/5 hover:text-brand-ink disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Quitar ${byId.get(id)?.name}`}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-brand-muted hover:bg-red-50 hover:text-red-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 text-sm italic text-brand-muted">{emptyText}</p>
      )}

      <div className="relative w-full max-w-sm">
        <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 py-2 text-brand-ink/70 focus-within:border-brand-pink">
          <SearchIcon className="h-4 w-4 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Buscar categoría para agregar..."
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-ink/40 focus:outline-none"
          />
        </label>

        {open && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-black/10 bg-white py-1 shadow-lg"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-brand-muted">Sin resultados</li>
            ) : (
              suggestions.map((c, i) => (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={i === active}
                  // mousedown (no click) para que el input no pierda el foco
                  // y la lista siga abierta para agregar varias seguidas.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c.id);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-3 py-2 text-sm text-brand-ink ${
                    i === active ? "bg-brand-pink/10 text-brand-pink-dark" : ""
                  }`}
                >
                  {c.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Con la lista abierta se reserva lugar debajo: la lista flota y, sin esto, el formulario termina justo después del buscador */}
      {open && <div className="h-64" aria-hidden />}
    </div>
  );
}
