"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { topLevelCategories, childrenOf } from "@/lib/categoryHelpers";
import type { CategoryItem } from "@/types/catalog";

// Una sola flechita para todo: la inclinación indica si lleva a la categoría (derecha) o si despliega (abajo / arriba)
function Chevron({ tilt = "right", className = "" }: { tilt?: "right" | "down" | "up"; className?: string }) {
  // Base: flecha ancha apuntando abajo; se gira para indicar derecha o arriba
  const rotate = tilt === "right" ? "-rotate-90" : tilt === "up" ? "rotate-180" : "";
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={`h-4 w-4 shrink-0 text-brand-pink transition-transform ${rotate} ${className}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CategorySidebar({
  categories,
  counts,
  activeCategoryId,
}: {
  categories: CategoryItem[];
  counts: Map<string, number>;
  activeCategoryId?: string;
}) {
  const visibleChildren = (id: string) => childrenOf(categories, id).filter((c) => (counts.get(c.id) ?? 0) > 0);
  const topLevel = topLevelCategories(categories).filter((c) => (counts.get(c.id) ?? 0) > 0);

  // Al entrar a una categoría, se abren sus padres para que se vea dónde está (cualquier profundidad)
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const open = new Set<string>();
    let cursor = activeCategoryId ? byId.get(activeCategoryId)?.parentId : null;
    while (cursor && !open.has(cursor)) {
      open.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    return open;
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const router = useRouter();

  // Buscador predictivo: busca en todas las categorías con productos (también subcategorías), sin tildes ni mayúsculas
  const results = useMemo(() => {
    const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const terms = norm(query.trim()).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return categories
      .filter((c) => (counts.get(c.id) ?? 0) > 0)
      .filter((c) => terms.every((t) => norm(c.name).includes(t)))
      .slice(0, 8);
  }, [query, categories, counts]);

  function goTo(slug: string) {
    setQuery("");
    setHighlight(0);
    router.push(`/categoria/${slug}`);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      goTo(results[highlight].slug);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  useEffect(() => {
    setPanelOpen(window.innerWidth > 800);
  }, []);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="shrink-0 sm:w-56">
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="mb-3 flex w-full cursor-pointer items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest text-brand-pink-dark"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <path strokeLinecap="round" d="M4 6h16M8 12h12M11 18h9" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="8" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Categorías
        </span>
        <Chevron tilt={panelOpen ? "up" : "down"} className="text-brand-pink-dark" />
      </button>

      <div className="relative mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onSearchKey}
          onBlur={() => setTimeout(() => setQuery(""), 150)}
          placeholder="Buscar categoría…"
          aria-label="Buscar una categoría"
          className="w-full rounded-lg border border-black/10 bg-white py-2 pl-8 pr-2 text-sm text-brand-ink placeholder:text-brand-muted focus:border-brand-pink focus:outline-none"
        />
        {query.trim() && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-black/10 bg-white py-1 shadow-lg">
            {results.length === 0 && <li className="px-3 py-2 text-sm text-brand-muted">Sin resultados</li>}
            {results.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    goTo(c.slug);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm text-brand-ink ${i === highlight ? "bg-brand-pink/10 text-brand-pink-dark" : ""}`}
                >
                  <span className="min-w-0 truncate">
                    {c.name}
                    {c.parentId && byId.get(c.parentId) && <span className="text-xs text-brand-muted"> · {byId.get(c.parentId)?.name}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.ul
            key="category-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="space-y-1 overflow-hidden text-sm"
          >
            <li>
              <Link
                href="/tienda"
                className={`flex items-center justify-between rounded-lg border-l-2 px-3 py-2 transition-colors ${
                  !activeCategoryId
                    ? "border-brand-pink bg-brand-pink/10 text-brand-pink-dark"
                    : "border-transparent text-brand-ink hover:bg-brand-pink/5"
                }`}
              >
                Todas
              </Link>
            </li>

            {topLevel.map((cat) => renderNode(cat))}
          </motion.ul>
        )}
      </AnimatePresence>
    </nav>
  );

  // Una categoría con subcategorías se abre al tocarla y empuja la lista hacia abajo; sin subcategorías lleva a su página.
  // Se repite en todos los niveles del árbol.
  function renderNode(cat: CategoryItem): React.ReactNode {
    const kids = visibleChildren(cat.id);
    const active = cat.id === activeCategoryId;
    const rowClass = `flex w-full items-center justify-between rounded-lg border-l-2 px-3 py-2 text-left transition-colors ${
      active ? "border-brand-pink bg-brand-pink/10 text-brand-pink-dark" : "border-transparent text-brand-ink hover:bg-brand-pink/5"
    }`;

    if (kids.length === 0) {
      return (
        <li key={cat.id}>
          <Link href={`/categoria/${cat.slug}`} className={rowClass}>
            {cat.name}
            <Chevron />
          </Link>
        </li>
      );
    }

    const isOpen = openIds.has(cat.id);
    return (
      <li key={cat.id}>
        <button type="button" onClick={() => toggle(cat.id)} aria-expanded={isOpen} className={rowClass}>
          {cat.name}
          <Chevron tilt={isOpen ? "up" : "down"} />
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.ul
              key={`sub-${cat.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="ml-3 mt-1 space-y-1 overflow-hidden border-l border-brand-pink/20 pl-3"
            >
              <li>
                <Link
                  href={`/categoria/${cat.slug}`}
                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[13px] text-brand-pink-dark hover:bg-brand-pink/5"
                >
                  Ver todo en {cat.name}
                  <Chevron />
                </Link>
              </li>
              {kids.map((child) => renderNode(child))}
            </motion.ul>
          )}
        </AnimatePresence>
      </li>
    );
  }
}
