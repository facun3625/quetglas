"use client";

import { useState, useTransition } from "react";
import { adjustUserPoints } from "./actions";

export function PointsAdjustForm({ userId }: { userId: string }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const field = "rounded-lg border border-black/10 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none";
  return (
    <form
      className="mt-3 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await adjustUserPoints(userId, Number(delta), reason);
          setMsg(result.ok ? { ok: true, text: "Saldo actualizado." } : { ok: false, text: result.error ?? "No se pudo ajustar" });
          if (result.ok) { setDelta(""); setReason(""); }
        });
      }}
    >
      <input type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+50 / -20" className={`${field} w-28`} />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo del ajuste" maxLength={200} className={`${field} min-w-[200px] flex-1`} />
      <button disabled={pending || !delta || !reason.trim()} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50">
        Ajustar
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
    </form>
  );
}
