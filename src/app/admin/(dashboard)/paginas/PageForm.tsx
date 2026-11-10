"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { deletePage, savePage, type PageInput } from "./actions";
import { useConfirm } from "@/lib/useConfirm";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

export function PageForm({ initial }: { initial: PageInput }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  const set = <K extends keyof PageInput>(k: K, v: PageInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="max-w-3xl pb-24">
      {dialog}
      <div className="space-y-4 rounded-xl border border-black/10 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Título</label>
            <input className={field} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={label}>URL (slug)</label>
            <input className={field} value={form.slug} placeholder="se genera del título" onChange={(e) => set("slug", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={label}>Contenido</label>
          <RichTextEditor
            name="content"
            initialValue={initial.content}
            onChange={(html) => set("content", html)}
            uploadImage={async (fd) => {
              const res = await fetch("/api/admin/images", { method: "POST", body: fd });
              const data = await res.json().catch(() => ({}));
              return res.ok ? { ok: true, url: data.url } : { ok: false, error: data.error ?? "No se pudo subir" };
            }}
          />
        </div>
        <div>
          <label className={label}>Descripción para buscadores (opcional)</label>
          <input className={field} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm text-brand-ink">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Publicada</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showInMenu} onChange={(e) => set("showInMenu", e.target.checked)} /> Mostrar en el menú</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showInFooter} onChange={(e) => set("showInFooter", e.target.checked)} /> Mostrar en el pie</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showContactForm} onChange={(e) => set("showContactForm", e.target.checked)} /> Incluir formulario de contacto</label>
          <label className="flex items-center gap-2">Orden <input type="number" className="w-20 rounded-lg border border-black/10 px-2 py-1" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></label>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-black/10 bg-white px-4 py-3 md:left-56">
        <button
          disabled={pending}
          onClick={() => start(async () => {
            setError(null);
            const result = await savePage(form);
            if (!result.ok) return setError(result.error);
            router.push("/admin/paginas");
            router.refresh();
          })}
          className="cursor-pointer rounded-lg bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar página"}
        </button>
        <button onClick={() => router.push("/admin/paginas")} className="cursor-pointer rounded-lg px-4 py-2.5 text-sm text-brand-muted hover:bg-black/5">Cancelar</button>
        {form.id && (
          <button
            onClick={async () => (await confirm({ title: "¿Eliminar esta página?", danger: true })) && start(async () => { await deletePage(form.id!); router.push("/admin/paginas"); router.refresh(); })}
            className="ml-auto cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Eliminar
          </button>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
