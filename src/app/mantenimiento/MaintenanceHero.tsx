"use client";

import { useSession, signOut } from "next-auth/react";
import { WrenchIcon, UserIcon, LogoutIcon } from "@/components/icons";
import { useAuthModal } from "@/lib/authModal";

export function MaintenanceHero({ whatsappNumber }: { whatsappNumber: string }) {
  const { data: session } = useSession();
  const { openLogin } = useAuthModal();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-pink/10 text-brand-pink-dark">
          <WrenchIcon className="h-8 w-8" />
        </div>
        {session?.user ? (
          <button
            onClick={() => signOut()}
            title="Cerrar sesión"
            className="flex h-11 items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
          >
            <UserIcon className="h-4.5 w-4.5 shrink-0" />
            <span className="max-w-[10rem] truncate">{session.user.name || session.user.email}</span>
            <LogoutIcon className="h-4 w-4 shrink-0" />
          </button>
        ) : (
          <button
            onClick={openLogin}
            title="Iniciar sesión"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
          >
            <UserIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <h1 className="mt-6 text-2xl font-bold text-brand-ink sm:text-3xl">Estamos mejorando la tienda</h1>
      <p className="mt-3 text-brand-muted">
        Estamos haciendo tareas de mantenimiento programado. Volvemos enseguida — gracias por la paciencia.
      </p>
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
        >
          Escribinos por WhatsApp
        </a>
      )}
    </div>
  );
}
