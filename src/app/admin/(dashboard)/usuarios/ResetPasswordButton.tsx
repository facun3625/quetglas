"use client";

import { useState, useTransition } from "react";
import { PasswordField } from "@/components/admin/PasswordField";
import { sendUserResetLink, setUserPassword } from "./actions";

// Sin caracteres que se confunden (0/O, 1/l/I) para que se pueda dictar por teléfono.
const CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

// "Contraseña" de cada fila de Clientes y usuarios (solo superadmin): define una contraseña nueva o
// manda un link por mail, por si alguien la olvidó.
export function ResetPasswordButton({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setOpen(false);
    setPassword("");
    setShow(false);
    setMsg(null);
  }

  function run(fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) after?.();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline">
        Contraseña
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 text-left backdrop-blur-sm" onClick={close}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-base font-bold text-brand-ink">Restablecer contraseña</h3>
            <p className="mt-1 text-sm text-brand-muted">
              Cuenta: <span className="font-medium text-brand-ink">{email}</span>
            </p>

            <div className="mt-4 rounded-xl border border-black/10 p-4">
              <p className="text-sm font-semibold text-brand-ink">Definir una contraseña nueva</p>
              <p className="mt-0.5 text-xs text-brand-muted">Mínimo 8 caracteres. Después pasásela a la persona por un canal seguro; la puede cambiar sola con “Olvidé mi contraseña”.</p>
              <div className="mt-3">
                <PasswordField value={password} onChange={setPassword} show={show} onToggle={() => setShow((v) => !v)} />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShow(true);
                  }}
                  className="cursor-pointer rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft"
                >
                  Generar una
                </button>
                <button
                  type="button"
                  disabled={pending || password.length < 8}
                  onClick={() => run(() => setUserPassword(userId, password), () => setPassword(""))}
                  className="cursor-pointer rounded-full bg-brand-pink px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50"
                >
                  {pending ? "Guardando…" : "Guardar contraseña"}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-black/10 p-4">
              <p className="text-sm font-semibold text-brand-ink">Mandarle un link por mail</p>
              <p className="mt-0.5 text-xs text-brand-muted">La persona crea su propia contraseña desde el link (vale 1 hora). Necesita que el correo de la tienda esté configurado.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => sendUserResetLink(userId))}
                className="mt-3 cursor-pointer rounded-full border border-black/10 px-4 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-50"
              >
                Enviar link
              </button>
            </div>

            {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={close} className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
