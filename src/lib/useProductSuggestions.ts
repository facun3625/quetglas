"use client";

import { useEffect, useState } from "react";
import type { ProductListItem } from "@/types/catalog";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250;

export function useProductSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=5`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setSuggestions(data.products);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { suggestions, loading, active: query.trim().length >= MIN_CHARS };
}
