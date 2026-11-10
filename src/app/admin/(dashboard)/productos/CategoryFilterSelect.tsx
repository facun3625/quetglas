"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Mismo criterio que LiveSearchInput: filtra al toque, sin esperar a que
// aprieten "Filtrar" (ese botón queda solo para el grupo de precio/stock).
export function CategoryFilterSelect({
  defaultValue,
  categories,
}: {
  defaultValue: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("categoryId", value);
    else params.delete("categoryId");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      name="categoryId"
      defaultValue={defaultValue}
      onChange={(e) => handleChange(e.target.value)}
      className={fieldClasses}
    >
      <option value="">Todas</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
