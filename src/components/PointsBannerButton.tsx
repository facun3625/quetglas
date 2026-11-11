"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthModal } from "@/lib/authModal";

// Botón del banner del club de puntos: sin sesión abre el login (modal); con sesión lleva a Mi cuenta → Puntos.
export function PointsBannerButton({ label, bg, accent, children }: { label: string; bg: string; accent: string; children?: React.ReactNode }) {
  const { status } = useSession();
  const { openLogin } = useAuthModal();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (status === "authenticated" ? router.push("/mi-cuenta/puntos") : openLogin())}
      className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wide shadow-md transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: accent, color: bg }}
    >
      {label}
      {children}
    </button>
  );
}
