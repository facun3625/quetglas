"use client";

import { useTransition } from "react";
import { deleteMessage, setMessageRead } from "../paginas/actions";
import { useConfirm } from "@/lib/useConfirm";

export function MessageActions({ id, read, email }: { id: string; read: boolean; email: string }) {
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const btn = "cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-50";
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {dialog}
      <a href={`mailto:${email}`} className={btn}>Responder por mail</a>
      <button disabled={pending} className={btn} onClick={() => start(() => setMessageRead(id, !read))}>
        {read ? "Marcar como no leído" : "Marcar como leído"}
      </button>
      <button disabled={pending} className={`${btn} text-red-600`} onClick={async () => (await confirm({ title: "¿Eliminar el mensaje?", danger: true })) && start(() => deleteMessage(id))}>
        Eliminar
      </button>
    </div>
  );
}
