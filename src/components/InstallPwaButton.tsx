"use client";

import { useEffect, useState } from "react";
import { useInstallPrompt } from "@/lib/useInstallPrompt";
import { enablePush, pushSupported, resyncPush } from "@/lib/pushClient";
import { DownloadIcon, ShareIcon } from "@/components/icons";

// Chrome/Firefox/Edge en iOS corren sobre WebKit pero no pueden instalar —
// esa capacidad no existe fuera de Safari en iOS.
function detectIOS() {
  if (typeof navigator === "undefined") return { isIOS: false, isIOSNonSafari: false };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isIOSNonSafari = /CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
  return { isIOS, isIOSNonSafari };
}

// Dentro de la app instalada (pie de página): muestra si las notificaciones están activas y deja activarlas con un toque
function NotificationsStatus() {
  const [state, setState] = useState<"unsupported" | "default" | "granted" | "denied" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const next = !pushSupported() ? "unsupported" : (Notification.permission as "default" | "granted" | "denied");
      setState(next);
      if (next === "granted") void resyncPush();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!state) return null;
  const note = "max-w-[16rem] text-center text-xs text-brand-muted";
  if (state === "granted") return <p className={note}>🔔 Notificaciones activadas</p>;
  if (state === "denied") return <p className={note}>Las notificaciones están bloqueadas. Activalas desde los Ajustes del teléfono, en Notificaciones.</p>;
  if (state === "unsupported") return <p className={note}>Este dispositivo no permite notificaciones (en iPhone hace falta iOS 16.4 o más nuevo).</p>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await enablePush().catch(() => false);
        setBusy(false);
        setState(ok ? "granted" : (Notification.permission as "default" | "granted" | "denied"));
      }}
      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark disabled:opacity-60"
    >
      🔔 Activar notificaciones
    </button>
  );
}

export function InstallPwaButton({ variant = "pill" }: { variant?: "pill" | "icon" }) {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isIOS, setIsIOS] = useState(false);
  const [isIOSNonSafari, setIsIOSNonSafari] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js", { scope: "/" }).catch(console.error);
    const frame = window.requestAnimationFrame(() => {
      const ios = detectIOS();
      setIsIOS(ios.isIOS);
      setIsIOSNonSafari(ios.isIOSNonSafari);
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function handleClick() {
    if (isIOS) {
      setShowIOSHelp(true);
    } else if (canInstall) {
      await promptInstall();
    } else {
      // Safari de escritorio, Firefox de escritorio, etc.: no existe
      // beforeinstallprompt ahí, así que "instalar" no es una opción — se
      // avisa en vez de esconder el botón sin explicar nada. Las
      // notificaciones sí se intentan igual (son una API aparte).
      setShowUnsupported(true);
    }

    await enablePush().catch(() => {});
  }

  // Antes esto se ocultaba del todo si el browser no soportaba
  // beforeinstallprompt (ej. Safari/Firefox de escritorio) — quedaba
  // invisible sin ninguna pista de por qué. Ahora se muestra siempre salvo
  // que ya esté instalada, y el click explica qué pasa según el navegador.
  // Ya instalada: el botón de descarga no tiene sentido, pero acá sí se puede ver y activar el estado de las notificaciones
  if (isStandalone) return variant === "pill" ? <NotificationsStatus /> : null;

  const isIcon = variant === "icon";

  return (
    <div className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={handleClick}
        title={isIcon ? "Descargar Web App" : undefined}
        aria-label={isIcon ? "Descargar Web App" : undefined}
        className={
          isIcon
            ? "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark sm:h-9 sm:w-9"
            : "flex min-h-11 max-w-full cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
        }
      >
        <DownloadIcon className={isIcon ? "h-4.5 w-4.5" : "h-4 w-4 shrink-0"} />
        {!isIcon && "Descargar Web App"}
      </button>

      {showIOSHelp && (
        <div
          className={`absolute z-30 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-4 text-left text-sm text-brand-ink shadow-lg ${
            isIcon ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2 sm:left-1/2 sm:-translate-x-1/2"
          }`}
        >
          {isIOSNonSafari ? (
            <p>Abrí este sitio en Safari para poder instalarlo — desde Chrome/Firefox en iOS no se puede.</p>
          ) : (
            <p className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5">
                Tocá <ShareIcon className="h-4 w-4 shrink-0" /> (Compartir) abajo,
              </span>
              <span>y después &ldquo;Agregar a inicio&rdquo;.</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setShowIOSHelp(false)}
            className="mt-3 cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
          >
            Entendido
          </button>
        </div>
      )}

      {showUnsupported && (
        <div
          className={`absolute z-30 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-4 text-left text-sm text-brand-ink shadow-lg ${
            isIcon ? "right-0 top-full mt-2" : "bottom-full left-0 mb-2 sm:left-1/2 sm:-translate-x-1/2"
          }`}
        >
          <p>
            Tu navegador no permite instalar la app todavía — probá desde Chrome o Edge en Android o en la compu. Si
            aceptaste el permiso recién, igual te van a llegar las notificaciones.
          </p>
          <button
            type="button"
            onClick={() => setShowUnsupported(false)}
            className="mt-3 cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
          >
            Entendido
          </button>
        </div>
      )}
    </div>
  );
}
