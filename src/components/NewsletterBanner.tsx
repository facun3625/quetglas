"use client";

import { useState } from "react";
import { MailIcon } from "@/components/icons";

export function NewsletterBanner({ storeName }: { storeName: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="px-3 py-3 sm:px-6 sm:py-5">
      <div className="mx-auto max-w-6xl rounded-3xl bg-brand-pink/10 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-brand-pink-dark shadow-sm sm:flex">
              <MailIcon className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-brand-pink-dark">Sumate a nuestro newsletter</h2>
              <p className="mt-1 text-sm text-brand-muted">
                Enterate primero de los nuevos ingresos y novedades de {storeName}.
              </p>
            </div>
          </div>

          {status === "ok" ? (
            <p className="shrink-0 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-pink-dark shadow-sm">
              ¡Listo! Ya estás suscripto.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex w-full max-w-sm shrink-0 flex-col gap-2 min-[400px]:flex-row">
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full flex-1 rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm text-brand-ink outline-none placeholder:text-brand-muted focus:border-brand-pink"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="min-h-11 shrink-0 cursor-pointer rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Suscribirme"}
              </button>
            </form>
          )}
        </div>
        {status === "error" && (
          <p className="mt-2 text-center text-xs text-red-600 sm:text-left">No se pudo suscribir. Probá de nuevo.</p>
        )}
      </div>
    </section>
  );
}
