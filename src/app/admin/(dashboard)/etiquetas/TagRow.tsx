"use client";

import { useState, useTransition } from "react";
import { deleteTag, renameTag } from "../productos/actions";
import { useConfirm } from "@/lib/useConfirm";

export function TagRow({ id, name, slug, products }: { id: string; name: string; slug: string; products: number }) {
  const [text, setText] = useState(name);
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      {dialog}
      <input value={text} onChange={(e) => setText(e.target.value)} className="min-w-[160px] flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm focus:border-brand-pink focus:outline-none" />
      <span className="text-xs text-brand-muted">/{slug} · {products} producto(s)</span>
      <button disabled={pending || text.trim() === name} onClick={() => start(() => renameTag(id, text))} className="cursor-pointer rounded-lg bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-40">Guardar</button>
      <button disabled={pending} onClick={async () => (await confirm({ title: `¿Borrar la etiqueta “${name}”?`, message: `Se quita de ${products} producto(s).`, danger: true })) && start(() => deleteTag(id))} className="cursor-pointer text-xs text-red-600 hover:underline">Eliminar</button>
    </div>
  );
}
