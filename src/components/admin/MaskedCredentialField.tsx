"use client";

import { useState } from "react";

export function MaskedCredentialField({
  name,
  label,
  configured,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  configured: boolean;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  const [editing, setEditing] = useState(!configured);

  return (
    <div className="min-w-[220px] flex-1">
      <label className="mb-1 block text-xs font-medium text-brand-muted">{label}</label>
      {editing ? (
        <input
          type={type}
          name={name}
          autoComplete={type === "password" ? "new-password" : "off"}
          required={required}
          placeholder={placeholder}
          autoFocus={configured}
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
        />
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
            </svg>
            Configurado
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}
