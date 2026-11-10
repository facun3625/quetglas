"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export function UserTypeFilter({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="w-48">
      <label className={labelClasses}>Tipo de cliente</label>
      <select
        defaultValue={defaultValue}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value === "all") params.delete("userType");
          else params.set("userType", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className={`${fieldClasses} bg-white`}
      >
        <option value="all">Todos</option>
        <option value="registered">Registrados</option>
        <option value="guest">Invitados (con email)</option>
        <option value="anonymous">Anónimos</option>
      </select>
    </div>
  );
}
