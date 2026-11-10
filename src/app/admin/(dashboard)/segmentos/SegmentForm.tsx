"use client";

import { useState, useTransition } from "react";
import { deleteSegment, saveSegment, type SegmentInput } from "./actions";
import { SEGMENT_TYPES, type SegmentParams } from "@/lib/segments";
import type { SegmentType } from "@/generated/prisma/enums";
import { useConfirm } from "@/lib/useConfirm";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

export function SegmentForm({ initial, coupons, members }: { initial: SegmentInput; coupons: { id: string; code: string }[]; members?: number }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const meta = SEGMENT_TYPES[form.type];

  function changeType(type: SegmentType) {
    setForm((f) => ({ ...f, type, params: { ...SEGMENT_TYPES[type].defaults } }));
  }

  return (
    <form
      className="rounded-xl border border-black/10 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveSegment(form);
          setMsg(result.ok ? { ok: true, text: "Guardado." } : { ok: false, text: result.error ?? "No se pudo guardar" });
          if (result.ok && !form.id) setForm({ ...initial });
        });
      }}
    >
      {dialog}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div>
          <label className={label}>Nombre</label>
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej.: Clientes VIP" />
        </div>
        <div>
          <label className={label}>Tipo</label>
          <select className={`${field} bg-white`} value={form.type} onChange={(e) => changeType(e.target.value as SegmentType)}>
            {Object.entries(SEGMENT_TYPES).map(([key, m]) => (
              <option key={key} value={key}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-2 text-xs text-brand-muted">{meta.description}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {meta.fields.map((f) => (
          <div key={f.key} className="min-w-[200px] flex-1">
            <label className={label}>{f.label}</label>
            <input
              type="number"
              min={f.min ?? 0}
              className={field}
              value={(form.params[f.key] as number | undefined) ?? ""}
              onChange={(e) => setForm({ ...form, params: { ...form.params, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) } as SegmentParams })}
            />
          </div>
        ))}
        {form.type === "from_coupon" && (
          <div className="min-w-[200px] flex-1">
            <label className={label}>Cupón</label>
            <select className={`${field} bg-white`} value={form.params.couponId ?? ""} onChange={(e) => setForm({ ...form, params: { couponId: e.target.value || undefined } })}>
              <option value="">Cualquier cupón</option>
              {coupons.map((c) => (
                <option key={c.id} value={c.id}>{c.code}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-brand-ink">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Activo
        </label>
        <button disabled={pending} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
          {form.id ? "Guardar" : "Crear segmento"}
        </button>
        {form.id && (
          <button type="button" onClick={async () => (await confirm({ title: "¿Eliminar este segmento?", danger: true })) && start(() => deleteSegment(form.id!))} className="cursor-pointer text-sm text-red-600 hover:underline">
            Eliminar
          </button>
        )}
        {members !== undefined && <span className="ml-auto text-sm text-brand-muted"><b className="text-brand-ink">{members}</b> cliente(s)</span>}
        {msg && <span className={`text-xs ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
