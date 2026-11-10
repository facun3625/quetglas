"use client";

import { EyeIcon } from "@/components/icons";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 pr-11 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

// Campo de contraseña con ojito para verla u ocultarla. `show` lo controla quien lo usa, así puede
// mostrarla sola cuando genera una (ver ResetPasswordButton).
export function PasswordField({
  value,
  onChange,
  show,
  onToggle,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} className={field} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        title={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-brand-muted hover:bg-brand-soft hover:text-brand-ink"
      >
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4.5 w-4.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4 9.5 7a11 11 0 0 1-2.6 3.9M6.6 6.7A11 11 0 0 0 2.5 12c1 3 4.5 7 9.5 7a9.7 9.7 0 0 0 4-.9" />
          </svg>
        ) : (
          <EyeIcon className="h-4.5 w-4.5" />
        )}
      </button>
    </div>
  );
}
