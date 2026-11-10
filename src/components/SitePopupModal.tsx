"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import type { SiteSettings } from "@/lib/settings";

const SEEN_KEY = "cortopassi:popup:seen";

// "No repetir" se controla por navegador (localStorage), no por IP: una IP
// real se comparte entre varios celulares de un mismo operador y cambia si
// el visitante pasa de wifi a datos, así que no sirve para identificar "ya
// lo vio" — ver el comentario en el schema. La clave guardada es el propio
// contenido (título+texto), así que si el admin edita el pop-up, vuelve a
// mostrarse aunque ya lo hayan visto antes con el texto viejo.
export function SitePopupModal({ popup }: { popup: SiteSettings["popup"] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const matchesScope =
    !!popup &&
    (popup.scope === "all" ||
      (popup.scope === "home" && pathname === "/") ||
      (popup.scope === "tienda" && (pathname === "/tienda" || pathname?.startsWith("/categoria"))));

  useEffect(() => {
    if (!popup || !matchesScope) return;

    if (popup.frequency === "once") {
      const contentKey = `${popup.title ?? ""}\n${popup.bodyHtml ?? ""}`;
      try {
        if (localStorage.getItem(SEEN_KEY) === contentKey) return;
      } catch {
        // Privado/bloqueado: no se puede recordar "ya lo vio" — se muestra
        // igual en vez de romper por esto.
      }
    }

    const timer = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function close() {
    setOpen(false);
    if (popup?.frequency === "once") {
      const contentKey = `${popup.title ?? ""}\n${popup.bodyHtml ?? ""}`;
      try {
        localStorage.setItem(SEEN_KEY, contentKey);
      } catch {
        // Sin localStorage disponible, simplemente puede volver a aparecer.
      }
    }
  }

  if (!popup) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={close}
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-brand-ink shadow-sm transition-colors hover:bg-white"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="max-h-[80vh] overflow-y-auto p-6">
              {popup.title && <h2 className="text-xl font-bold text-brand-ink">{popup.title}</h2>}
              {popup.bodyHtml && (
                <div
                  className={`text-sm leading-relaxed text-brand-ink/90 [&_a]:text-brand-pink-dark [&_a]:underline [&_img]:max-w-full [&_img]:rounded-lg ${popup.title ? "mt-3" : ""}`}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(popup.bodyHtml) }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
