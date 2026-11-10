"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mientras haya una campaña "sending", refresca la página cada 4s para que
// el contador de enviados vaya avanzando solo (el envío real pasa en
// segundo plano en el server, ver actions.ts).
export function MailHistoryPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
