"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PAGE_SIZES, SORT_OPTIONS } from "./listOptions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

function useParamNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (change: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    change(params);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

// Orden del listado: se aplica al elegirlo, igual que el buscador y la categoría
export function SortSelect({ sort, dir }: { sort: string; dir: string }) {
  const navigate = useParamNavigator();
  return (
    <select
      aria-label="Ordenar por"
      value={`${sort}:${dir}`}
      onChange={(e) => {
        const [field, direction] = e.target.value.split(":");
        navigate((p) => {
          p.set("sort", field);
          p.set("dir", direction);
        });
      }}
      className={fieldClasses}
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Cuántos productos se ven por página
export function PerPageSelect({ value }: { value: number }) {
  const navigate = useParamNavigator();
  return (
    <select
      aria-label="Productos por página"
      value={String(value)}
      onChange={(e) => navigate((p) => p.set("per", e.target.value))}
      className={fieldClasses}
    >
      {PAGE_SIZES.map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}
