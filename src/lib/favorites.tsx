"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type FavoritesContextValue = {
  ids: Set<string>;
  isFavorite: (productId: string) => boolean;
  toggle: (productId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// A diferencia del carrito, los favoritos viven en la base (atados al
// usuario, no a localStorage) — requieren estar logueado. Se cargan una vez
// por sesión de auth; el toggle es optimista (refleja el click al toque) y
// revierte si el request al server falla.
export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status !== "authenticated") {
      setIds(new Set());
      return;
    }
    fetch("/api/favorites")
      .then((res) => res.json())
      .then((data: { productIds: string[] }) => setIds(new Set(data.productIds)))
      .catch(() => {});
  }, [status]);

  async function toggle(productId: string) {
    const wasFavorite = ids.has(productId);
    setIds((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(productId);
      else next.add(productId);
      return next;
    });

    try {
      const res = await fetch("/api/favorites", {
        method: wasFavorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error("request failed");
    } catch {
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.add(productId);
        else next.delete(productId);
        return next;
      });
    }
  }

  return (
    <FavoritesContext.Provider value={{ ids, isFavorite: (id) => ids.has(id), toggle }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites debe usarse dentro de <FavoritesProvider>");
  return ctx;
}
