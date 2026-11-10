"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const input = "mt-1 w-full rounded-lg border border-black/15 px-4 py-2.5 text-sm outline-none focus:border-brand-pink";
const button =
  "w-full cursor-pointer rounded-full bg-brand-pink py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark disabled:opacity-60";

export function RecoverForm() {
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (token && password !== confirm) return setError("Las contraseñas no coinciden");
    setLoading(true);
    const res = await fetch(token ? "/api/auth/reset" : "/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(token ? { token, password } : { email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "No se pudo completar la operación");
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">{token ? "¡Contraseña actualizada!" : "Revisá tu email"}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          {token
            ? "Ya podés iniciar sesión con tu nueva contraseña."
            : "Si hay una cuenta con ese email, te enviamos un enlace para crear una nueva contraseña. Puede tardar unos minutos."}
        </p>
        {token && (
          <Link href="/login" className="mt-6 inline-block rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark">
            Iniciar sesión
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-bold text-brand-ink">{token ? "Creá tu contraseña" : "Recuperar contraseña"}</h1>
      <p className="mt-1 text-sm text-brand-muted">
        {token ? "Elegí una contraseña de al menos 8 caracteres." : "Ingresá tu email y te enviamos un enlace para crear una nueva."}
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        {token ? (
          <>
            <div>
              <label className="text-sm font-medium text-brand-ink">Nueva contraseña</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={input} autoComplete="new-password" />
            </div>
            <div>
              <label className="text-sm font-medium text-brand-ink">Repetir contraseña</label>
              <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} autoComplete="new-password" />
            </div>
          </>
        ) : (
          <div>
            <label className="text-sm font-medium text-brand-ink">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={button}>
          {loading ? "Enviando..." : token ? "Guardar contraseña" : "Enviar enlace"}
        </button>
      </form>
    </div>
  );
}
