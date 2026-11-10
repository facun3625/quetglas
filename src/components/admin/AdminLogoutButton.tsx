"use client";

import { signOut } from "next-auth/react";
import { LogoutIcon } from "@/components/icons";

export function AdminLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-brand-ink/80 transition-colors hover:bg-black/[0.04] hover:text-brand-ink"
    >
      <LogoutIcon className="h-3.5 w-3.5 shrink-0" />
      Cerrar sesión
    </button>
  );
}
