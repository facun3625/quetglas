import type { ProductListItem } from "@/types/catalog";
import { useMoney } from "@/lib/currency";

export function SearchSuggestions({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: ProductListItem[];
  loading: boolean;
  onSelect: (name: string) => void;
}) {
  const { formatMoney } = useMoney();
  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
      {loading && suggestions.length === 0 ? (
        <p className="px-4 py-3 text-sm text-brand-muted">Buscando...</p>
      ) : suggestions.length === 0 ? (
        <p className="px-4 py-3 text-sm text-brand-muted">Sin resultados.</p>
      ) : (
        <ul>
          {suggestions.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(p.name)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-brand-soft"
              >
                {p.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumb}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg bg-brand-soft object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-brand-soft" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-brand-ink">{p.name}</span>
                  <span className="block text-xs font-semibold text-brand-pink-dark">
                    {formatMoney(p.price)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
