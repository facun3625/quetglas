"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SegmentFilter({ segments, current }: { segments: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <select
      value={current}
      onChange={(e) => {
        const sp = new URLSearchParams(params.toString());
        if (e.target.value) sp.set("segment", e.target.value);
        else sp.delete("segment");
        router.push(`/admin/usuarios?${sp.toString()}`);
      }}
      className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
    >
      <option value="">Todos los clientes</option>
      {segments.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}
