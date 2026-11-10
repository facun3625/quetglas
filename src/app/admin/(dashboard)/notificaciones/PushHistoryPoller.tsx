"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mismo patrón que MailHistoryPoller (Mailing): mientras haya una campaña
// push "sending", refresca la página cada 4s para que el contador avance
// solo — el envío real pasa en segundo plano en el server.
export function PushHistoryPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [active, router]);

  return null;
}
