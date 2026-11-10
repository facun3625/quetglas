"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCartRecoverySettings, sendCartRecoveryTest, setCartRecoveryEnabled } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

type Msg = { ok: boolean; text: string } | null;

// Interruptor + ajustes de la recuperación automática de carritos por mail.
export function CartRecoveryPanel({
  initial,
  mailReady,
  sentLast7Days,
  defaults,
  mailQuotaExhausted = false,
}: {
  initial: { enabled: boolean; delayHours: number; subject: string; message: string };
  mailReady: boolean;
  sentLast7Days: number;
  defaults: { subject: string; message: string };
  mailQuotaExhausted?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [delay, setDelay] = useState(String(initial.delayHours));
  const [subject, setSubject] = useState(initial.subject);
  const [message, setMessage] = useState(initial.message);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message: string }>, onOk?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) onOk?.();
      router.refresh();
    });
  }

  function toggle() {
    const next = !enabled;
    run(() => setCartRecoveryEnabled(next), () => setEnabled(next));
  }

  return (
    <div className="mt-5 rounded-xl border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-brand-ink">
            Recuperación automática por mail
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{enabled ? "Activa" : "Suspendida"}</span>
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            {enabled
              ? `Si alguien deja productos y no compra en ${initial.delayHours} h, recibe un mail con el link para retomar su carrito. Enviados en los últimos 7 días: ${sentLast7Days}.`
              : "Prendela para mandar un mail automático a quien dejó productos en el carrito. Mientras esté suspendida no se manda nada."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpen((v) => !v)} className="cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline">
            {open ? "Ocultar ajustes" : "Ajustes"}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Recuperación automática por mail"
            disabled={pending}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-brand-pink" : "bg-gray-200"}`}
          >
            <span className={`absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {mailQuotaExhausted && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Se agotó el cupo mensual de mails: la recuperación automática está frenada hasta el mes que viene (o hasta que se suba el cupo en Configuración → Consumo).
        </p>
      )}

      {!mailReady && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">El correo todavía no está configurado (Configuración → Correo). Sin eso no se puede activar.</p>
      )}

      {open && (
        <div className="mt-4 border-t border-black/5 pt-4">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div>
              <label className={label}>Esperar (horas)</label>
              <input type="number" min={1} max={72} className={field} value={delay} onChange={(e) => setDelay(e.target.value)} />
              <p className="mt-1 text-[11px] text-brand-muted">Entre 1 y 72. Desde la última actividad del carrito.</p>
            </div>
            <div>
              <label className={label}>Asunto del mail</label>
              <input className={field} value={subject} maxLength={120} placeholder={defaults.subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Mensaje (aparece arriba de la lista de productos)</label>
              <textarea className={`${field} min-h-20`} value={message} maxLength={600} placeholder={defaults.message} onChange={(e) => setMessage(e.target.value)} />
              <p className="mt-1 text-[11px] text-brand-muted">Si lo dejás vacío se usa el texto que se ve de ejemplo. El mail incluye los productos con su precio de hoy, el botón “Completar mi compra” y un link para no recibir más avisos.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => saveCartRecoverySettings({ delayHours: Number(delay), subject, message }))}
              className="cursor-pointer rounded-full bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar ajustes"}
            </button>
            <button
              type="button"
              disabled={pending || !mailReady}
              onClick={() => run(sendCartRecoveryTest)}
              className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-50"
            >
              Enviarme una prueba
            </button>
          </div>
          <p className="mt-3 text-xs text-brand-muted">
            Reglas: un mail por carrito (como mucho uno cada 3 días), solo a carritos de los últimos 3 días, nunca a quien ya compró después ni a quien pidió no recibir más. Los productos sin stock no se incluyen.
          </p>
        </div>
      )}

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
