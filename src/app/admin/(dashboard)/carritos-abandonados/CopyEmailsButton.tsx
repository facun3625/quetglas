"use client";

import { useState } from "react";

export function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (emails.length === 0) return;
    await navigator.clipboard.writeText(emails.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={emails.length === 0}
      className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? "¡Copiado!" : `Copiar emails (${emails.length})`}
    </button>
  );
}
