"use client";

import { useRef } from "react";
import type { ProductListItem } from "@/types/catalog";
import { ProductCard } from "@/components/ProductCard";

export function ProductCarousel({ products }: { products: ProductListItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  const arrowClasses =
    "flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-white p-3 text-brand-pink-dark shadow-md transition-colors hover:bg-brand-pink hover:text-white";

  return (
    <div>
      <div className="flex items-center gap-5">
        <button onClick={() => scroll(-1)} aria-label="Anterior" className={`hidden sm:flex ${arrowClasses}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          className="flex flex-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p) => (
            <div
              key={p.id}
              className="w-[calc((100%-1rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]"
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>

        <button onClick={() => scroll(1)} aria-label="Siguiente" className={`hidden sm:flex ${arrowClasses}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 sm:hidden">
        <button onClick={() => scroll(-1)} aria-label="Anterior" className={arrowClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button onClick={() => scroll(1)} aria-label="Siguiente" className={arrowClasses}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
