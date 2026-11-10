import Link from "next/link";

function pageList(current: number, total: number): (number | "...")[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({
  basePath,
  query,
  currentPage,
  totalPages,
  extraParams,
}: {
  basePath: string;
  query?: string;
  currentPage: number;
  totalPages: number;
  extraParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function href(page: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        if (value) params.set(key, value);
      }
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Paginación">
      <Link
        href={href(Math.max(1, currentPage - 1))}
        aria-disabled={currentPage === 1}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors ${
          currentPage === 1 ? "pointer-events-none opacity-30" : "hover:border-brand-pink hover:text-brand-pink-dark"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        </svg>
      </Link>

      {pageList(currentPage, totalPages).map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-brand-muted">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
              p === currentPage
                ? "bg-brand-pink font-semibold text-white"
                : "text-brand-ink hover:bg-brand-soft"
            }`}
          >
            {p}
          </Link>
        )
      )}

      <Link
        href={href(Math.min(totalPages, currentPage + 1))}
        aria-disabled={currentPage === totalPages}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors ${
          currentPage === totalPages
            ? "pointer-events-none opacity-30"
            : "hover:border-brand-pink hover:text-brand-pink-dark"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </nav>
  );
}
