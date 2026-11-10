"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/lib/useConfirm";
import { deleteContactCard, moveContactCard, saveContactCard, type ContactCardInput } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

export function ContactCardForm({ initial, canUp = false, canDown = false }: { initial: ContactCardInput; canUp?: boolean; canDown?: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const isNew = !initial.id;
  // Las tarjetas ya cargadas se ven cerradas (resumen + Editar); la nueva arranca cerrada detrás de un botón
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<ContactCardInput>) => setForm((f) => ({ ...f, ...patch }));

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveContactCard(form);
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      if (isNew) setForm(initial);
      setMsg(isNew ? { ok: true, text: "Tarjeta agregada." } : null);
      setOpen(false);
      router.refresh();
    });
  }

  if (isNew && !open) {
    return (
      <div>
        <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark">
          + Nueva tarjeta
        </button>
        {msg?.ok && <span className="ml-3 text-sm text-green-700">{msg.text}</span>}
      </div>
    );
  }

  if (!isNew && !open) {
    const summary = [initial.address, initial.phone, initial.whatsapp, initial.instagram].filter(Boolean).join(" · ");
    return (
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 ${initial.enabled ? "" : "opacity-60"}`}>
        {dialog}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-brand-ink">
            {initial.title}
            {!initial.enabled && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-brand-muted">Oculta</span>}
          </p>
          <p className="truncate text-xs text-brand-muted">{summary || "Sin datos cargados"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" disabled={pending || !canUp} title="Mover antes" onClick={() => start(async () => { await moveContactCard(initial.id!, "up"); router.refresh(); })} className="cursor-pointer rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-30">◀</button>
          <button type="button" disabled={pending || !canDown} title="Mover después" onClick={() => start(async () => { await moveContactCard(initial.id!, "down"); router.refresh(); })} className="cursor-pointer rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-30">▶</button>
          <button type="button" onClick={() => setOpen(true)} className="ml-1 cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">Editar</button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => (await confirm({ title: `¿Eliminar “${initial.title}”?`, danger: true })) && start(async () => { await deleteContactCard(initial.id!); router.refresh(); })}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${form.enabled ? "border-black/10" : "border-black/10 opacity-70"}`}>
      {dialog}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Título</label>
          <input className={field} value={form.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Cotillón" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Dirección</label>
          <input className={field} value={form.address} maxLength={120} onChange={(e) => set({ address: e.target.value })} placeholder="San Martín 2528" />
        </div>
        <div>
          <label className={label}>Teléfono</label>
          <input className={field} value={form.phone} maxLength={40} onChange={(e) => set({ phone: e.target.value })} placeholder="+54 342 4532945" />
        </div>
        <div>
          <label className={label}>WhatsApp</label>
          <input className={field} value={form.whatsapp} maxLength={40} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="+54 342 4056815" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Instagram</label>
          <input className={field} value={form.instagram} maxLength={100} onChange={(e) => set({ instagram: e.target.value })} placeholder="@tutienda" />
        </div>
      </div>
      <p className="mt-2 text-xs text-brand-muted">Dejá vacío lo que no corresponda: solo se muestran los datos que cargues.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
        <button type="button" disabled={pending} onClick={save} className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
          {pending ? "Guardando…" : isNew ? "Agregar tarjeta" : "Guardar"}
        </button>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-brand-ink">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="accent-brand-pink" />
          Visible en el sitio
        </label>
        <button type="button" disabled={pending} onClick={() => { setForm(initial); setMsg(null); setOpen(false); }} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-brand-muted hover:bg-black/5">
          Cancelar
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
