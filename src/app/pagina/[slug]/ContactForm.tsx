"use client";

import { useState } from "react";

const input = "mt-1 w-full rounded-lg border border-black/15 px-4 py-2.5 text-sm outline-none focus:border-brand-pink";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo enviar el mensaje");
      return setState("idle");
    }
    setState("done");
  }

  if (state === "done") {
    return <p className="mt-8 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">¡Gracias! Recibimos tu mensaje y te respondemos a la brevedad.</p>;
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-ink">Escribinos</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-brand-ink">Nombre</label>
          <input name="name" required maxLength={100} className={input} />
        </div>
        <div>
          <label className="text-sm font-medium text-brand-ink">Email</label>
          <input name="email" type="email" required maxLength={254} className={input} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-brand-ink">Teléfono (opcional)</label>
        <input name="phone" maxLength={40} className={input} />
      </div>
      <div>
        <label className="text-sm font-medium text-brand-ink">Mensaje</label>
        <textarea name="message" required minLength={5} maxLength={3000} rows={5} className={input} />
      </div>
      {/* Campo trampa para bots: una persona no lo ve ni lo completa */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={state === "sending"} className="cursor-pointer self-start rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60">
        {state === "sending" ? "Enviando..." : "Enviar mensaje"}
      </button>
    </form>
  );
}
