"use client";

import { useRef, useState, useTransition } from "react";
import { testMailSending, type MailTestState } from "./actions";

// Botón "Probar mail" de la card de Mailing. Lee los valores actuales del
// form más cercano (sin necesidad de haber guardado) y manda un mail de
// prueba a la dirección que cargues acá — mismo patrón que "Probar Telegram".
export function MailTestButton() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [to, setTo] = useState("");
  const [state, setState] = useState<MailTestState | null>(null);
  const [pending, startTransition] = useTransition();

  function field(form: HTMLFormElement, name: string): string {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement) return el.type === "checkbox" ? (el.checked ? "on" : "") : el.value;
    return "";
  }

  function handleClick() {
    const form = btnRef.current?.closest("form");
    if (!form) return;

    const values = {
      mailProvider: field(form, "mailProvider"),
      mailFromEmail: field(form, "mailFromEmail"),
      mailFromName: field(form, "mailFromName"),
      smtpHost: field(form, "smtpHost"),
      smtpPort: field(form, "smtpPort"),
      smtpSecure: field(form, "smtpSecure"),
      smtpUser: field(form, "smtpUser"),
      smtpPassword: field(form, "smtpPassword"),
      resendApiKey: field(form, "resendApiKey"),
    };

    startTransition(async () => {
      const result = await testMailSending(to, values);
      setState(result);
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Mandar prueba a: tu@email.com"
        className="min-w-[220px] flex-1 rounded-lg border border-black/10 px-3.5 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
      />
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        disabled={pending || !to.trim()}
        className="cursor-pointer rounded-full border border-brand-pink px-5 py-2 text-sm font-semibold text-brand-pink-dark transition-colors hover:bg-brand-pink/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Probar mail"}
      </button>
      {state?.ok === true && (
        <span className="text-sm font-medium text-green-600">✓ Enviado — revisá la bandeja de entrada.</span>
      )}
      {state?.ok === false && state.error && (
        <span className="max-w-md text-sm font-medium text-red-600">✗ {state.error}</span>
      )}
    </div>
  );
}
