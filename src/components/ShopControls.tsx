"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { useProductSuggestions } from "@/lib/useProductSuggestions";
import { SearchSuggestions } from "@/components/SearchSuggestions";

export function ShopControls({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(query);
  const [focused, setFocused] = useState(false);
  const { suggestions, loading, active } = useProductSuggestions(value);

  function navigate(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setFocused(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate(value.trim());
      }}
      className="relative"
    >
      <label className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-brand-ink/70 focus-within:border-brand-pink">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Buscar productos..."
          className="w-full bg-transparent text-sm text-brand-ink placeholder:text-brand-ink/40 focus:outline-none"
        />
      </label>
      {focused && active && (
        <SearchSuggestions
          suggestions={suggestions}
          loading={loading}
          onSelect={(name) => {
            setValue(name);
            navigate(name);
          }}
        />
      )}
    </form>
  );
}
