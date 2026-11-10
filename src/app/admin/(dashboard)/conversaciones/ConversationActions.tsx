"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteConversation, setConversationHandled } from "./actions";

// Botones del detalle de una conversación: marcarla como atendida y eliminarla (con confirmación)
export function ConversationActions({ id, handled }: { id: string; handled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await setConversationHandled(id, !handled); router.refresh(); })}
          className="cursor-pointer rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-60"
        >
          {handled ? "Volver a pendiente" : "Marcar como atendida"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className="cursor-pointer rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Eliminar
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="¿Eliminar esta conversación?"
        message="Se borra la conversación y los datos de contacto que dejó. No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          start(async () => { await deleteConversation(id); router.push("/admin/conversaciones"); });
        }}
      />
    </>
  );
}
