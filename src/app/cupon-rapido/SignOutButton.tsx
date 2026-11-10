"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
    >
      Cerrar sesión
    </button>
  );
}
