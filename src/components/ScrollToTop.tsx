"use client";

import { useEffect } from "react";

export function ScrollToTop({ watch }: { watch: string }) {
  useEffect(() => {
    // Doble rAF: corre después de que el router de Next termine su propio
    // ajuste de scroll (que a veces "mantiene" la posición si la página
    // destino es lo bastante alta como para seguir intersectando el viewport).
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // "instant" (no "auto") para saltar directo al top, ignorando el
        // scroll-behavior: smooth global usado para los anchors del navbar.
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [watch]);

  return null;
}
