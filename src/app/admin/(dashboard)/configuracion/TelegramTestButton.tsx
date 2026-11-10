"use client";

import { useRef, useState, useTransition } from "react";
import { testTelegram, type TelegramTestState } from "./actions";

// Botón "Probar" de la card de Telegram. En vez de depender de que el submit
// del form comparta sus campos, al hacer click lee directo los valores de los
// inputs (busca el <form> más cercano) y llama a la action. Así funciona aunque
// no hayas guardado todavía.
export function TelegramTestButton() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<TelegramTestState | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const form = btnRef.current?.closest("form");
    const token = (form?.elements.namedItem("telegramBotToken") as HTMLInputElement | null)?.value ?? "";
    const chatId = (form?.elements.namedItem("telegramChatId") as HTMLInputElement | null)?.value ?? "";

    startTransition(async () => {
      const result = await testTelegram(token, chatId);
      setState(result);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="cursor-pointer rounded-full border border-brand-pink px-5 py-2 text-sm font-semibold text-brand-pink-dark transition-colors hover:bg-brand-pink/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Probar Telegram"}
      </button>
      {state?.ok === true && (
        <span className="text-sm font-medium text-green-600">✓ Enviado — fijate en el grupo de Telegram.</span>
      )}
      {state?.ok === false && state.error && (
        <span className="text-sm font-medium text-red-600">✗ {state.error}</span>
      )}
    </div>
  );
}
