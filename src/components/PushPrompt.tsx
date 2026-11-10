"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { enablePush, pushSupported, resyncPush } from "@/lib/pushClient";

// Dentro de la app instalada (pantalla de inicio del celular o de la compu) ofrece activar los avisos de ofertas y novedades.
// Hace falta porque el botón "Descargar Web App" desaparece una vez instalada, y en iPhone el permiso solo se puede pedir
// desde adentro de la app instalada y con un toque. Si ya hay permiso, solo vuelve a registrar la suscripción.
const DISMISS_KEY = "push_prompt_dismissed_at";
const SNOOZE_MS = 14 * 24 * 3600_000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PushPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || !isStandalone()) return;
    if (Notification.permission === "granted") {
      void resyncPush();
      return;
    }
    if (Notification.permission !== "default") return; // bloqueadas: no se insiste
    let snoozed = false;
    try {
      snoozed = Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < SNOOZE_MS;
    } catch {}
    if (snoozed) return;
    const timer = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!show || pathname.startsWith("/admin") || pathname.startsWith("/carrito")) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  }

  return (
    <div role="dialog" aria-label="Activar notificaciones" className="fixed inset-x-3 bottom-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white p-4 shadow-xl sm:bottom-5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-brand-ink">¿Querés enterarte de las ofertas?</p>
        <p className="mt-0.5 text-xs text-brand-muted">Te avisamos de novedades, promos y cuando vuelve algo que esperabas. Podés desactivarlo cuando quieras.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await enablePush().catch(() => false);
            setBusy(false);
            dismiss();
          }}
          className="cursor-pointer rounded-full bg-brand-pink px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60"
        >
          Activar
        </button>
        <button type="button" onClick={dismiss} className="cursor-pointer text-xs text-brand-muted hover:text-brand-ink">Ahora no</button>
      </div>
    </div>
  );
}
