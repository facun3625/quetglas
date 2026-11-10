"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markOrdersSeen } from "./actions";

// Al abrir Ventas, los pedidos de la página pasan a "vistos" y se refresca el menú y la campanita. Los que eran nuevos
// siguen marcados con "Nuevo" en esta visita (la lista ya se armó con esa marca).
export function MarkSeen({ ids }: { ids: string[] }) {
  const router = useRouter();
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    markOrdersSeen(key.split(",")).then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [key, router]);
  return null;
}
