"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCartSessionId } from "@/lib/cartSession";

// Manda una vista de página por cada cambio de ruta del sitio público. Vive
// aparte de SiteChrome (que decide cuándo montarlo — nunca en /admin) para
// no mezclar tracking con el layout. Reusa el mismo sessionId anónimo que ya
// usa el carrito, así "visitas" se puede calcular como sesiones distintas
// sin inventar un segundo mecanismo de sesión.
//
// En la primera página de cada sesión del navegador (la "llegada") además manda de dónde vino la persona: la página que la
// refirió y los parámetros del link (UTM, fbclid…). El servidor lo clasifica (lib/trafficSource.ts).
const LANDED_KEY = "visit_landed";

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const sessionId = getCartSessionId();
    if (!sessionId) return;

    let landing: { referrer: string; search: string } | undefined;
    try {
      if (!sessionStorage.getItem(LANDED_KEY)) {
        sessionStorage.setItem(LANDED_KEY, "1");
        landing = { referrer: document.referrer.slice(0, 300), search: window.location.search.slice(0, 500) };
      }
    } catch {
      /* sin sessionStorage: se registra la vista sin origen */
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, sessionId, landing }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
