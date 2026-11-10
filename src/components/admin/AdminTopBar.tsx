"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { BellIcon, LogoutIcon, StoreIcon } from "@/components/icons";
import type { AdminCounts } from "@/lib/adminCounts";

const ROLE_LABEL: Record<string, string> = { superadmin: "Superadministrador", admin: "Administrador" };

function useClickAway(onAway: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onAway();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  });
  return ref;
}

// Barra superior del panel: campanita con lo que necesita atención y menú del perfil
export function AdminTopBar({ name, email, role, counts }: { name: string; email: string; role: string; counts: AdminCounts }) {
  const [bell, setBell] = useState(false);
  const [profile, setProfile] = useState(false);
  const bellRef = useClickAway(() => setBell(false));
  const profileRef = useClickAway(() => setProfile(false));

  // Solo lo que todavía no se vio: un pedido deja de contar en cuanto se abre Ventas, aunque siga pendiente de confirmar
  // (los pedidos con pago pendiente hace más de 24 horas se avisan en el inicio del panel).
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const alerts = [
    counts.newOrders > 0 && { href: "/admin/ventas", text: plural(counts.newOrders, "pedido nuevo", "pedidos nuevos"), hint: "", urgent: true },
    counts.unreadMessages > 0 && { href: "/admin/mensajes", text: `${counts.unreadMessages} mensaje${counts.unreadMessages === 1 ? "" : "s"} sin leer`, hint: "", urgent: false },
    counts.pendingConversations > 0 && { href: "/admin/conversaciones", text: plural(counts.pendingConversations, "consulta de la vendedora con teléfono", "consultas de la vendedora con teléfono"), hint: "Para contactar si la IA no resolvió", urgent: false },
  ].filter(Boolean) as { href: string; text: string; hint: string; urgent: boolean }[];
  const total = counts.newOrders + counts.unreadMessages + counts.pendingConversations;
  const initials = (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";

  return (
    <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-b border-black/5 bg-white px-4 sm:px-6">
      {/* Campanita */}
      <div ref={bellRef} className="relative">
        <button
          type="button"
          onClick={() => { setBell((v) => !v); setProfile(false); }}
          aria-label={total > 0 ? `${total} novedades` : "Sin novedades"}
          className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-brand-soft hover:text-brand-ink"
        >
          <BellIcon className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-pink px-1 text-[10px] font-bold text-white">{total > 99 ? "99+" : total}</span>
          )}
        </button>
        {bell && (
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">Novedades</p>
            {alerts.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-brand-muted">Todo al día ✓</p>
            ) : (
              alerts.map((a) => (
                <Link key={a.href} href={a.href} onClick={() => setBell(false)} className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-brand-soft">
                  <span className={`text-sm font-semibold ${a.urgent ? "text-brand-pink-dark" : "text-brand-ink"}`}>{a.text}</span>
                  {a.hint && <span className="block text-xs text-brand-muted">{a.hint}</span>}
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Perfil */}
      <div ref={profileRef} className="relative">
        <button
          type="button"
          onClick={() => { setProfile((v) => !v); setBell(false); }}
          aria-label="Mi perfil"
          className="flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-brand-soft"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-pink text-xs font-bold text-white">{initials}</span>
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-brand-ink sm:block">{name || email}</span>
        </button>
        {profile && (
          <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-brand-ink">{name || "Mi cuenta"}</p>
              <p className="truncate text-xs text-brand-muted">{email}</p>
              <span className="mt-1.5 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-pink-dark">{ROLE_LABEL[role] ?? "Administrador"}</span>
            </div>
            <div className="my-1 border-t border-black/5" />
            <Link href="/" onClick={() => setProfile(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-soft">
              <StoreIcon className="h-4 w-4 shrink-0" />
              Ver la tienda
            </Link>
            <button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-brand-ink transition-colors hover:bg-brand-soft">
              <LogoutIcon className="h-4 w-4 shrink-0" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
