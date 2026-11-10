"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogoField } from "../../configuracion/LogoField";
import { DeleteCategoryButton } from "../DeleteCategoryButton";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { saveCategoryDetails, type CategoryInput } from "../actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";
const card = "rounded-xl border border-black/10 bg-white p-5";

export function CategoryForm({
  id,
  products,
  subcategories,
  parentOptions,
  initial,
}: {
  id: string;
  products: number;
  subcategories: number;
  parentOptions: { id: string; label: string }[];
  initial: CategoryInput;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CategoryInput>(key: K, value: CategoryInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveCategoryDetails(id, form);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Guardado." } : { ok: false, text: r.error });
      if (r.ok) {
        router.refresh();
        setTimeout(() => setMsg((m) => (m?.ok ? null : m)), 5000);
      }
    });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-ink">Editar categoría</h1>
        <p className="text-sm text-brand-muted">
          {products > 0 ? <Link href={`/admin/productos?categoryId=${id}`} className="font-medium text-brand-pink-dark hover:underline">{products} producto{products === 1 ? "" : "s"}</Link> : "0 productos"}
          {" · "}{subcategories} subcategoría{subcategories === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <div className={card}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Nombre</label>
                <input className={field} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <label className={label}>Slug (la dirección en la web)</label>
                <input className={field} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="automático" />
              </div>
              <div>
                <label className={label}>Categoría padre</label>
                <select className={`${field} bg-white`} value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
                  <option value="">— Ninguna (nivel superior)</option>
                  {parentOptions.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Orden (menor = primero)</label>
                <input type="number" className={field} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Descripción (opcional)</label>
                <textarea className={field} rows={3} value={form.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} />
              </div>
            </div>
          </div>

          <div className={card}>
            <p className="text-sm font-semibold text-brand-ink">Cartel de "todavía sin productos"</p>
            <p className="mb-3 text-xs text-brand-muted">
              Para una categoría que armaste pero todavía no cargaste productos. Si escribís algo acá, esta categoría
              se va a seguir mostrando en el menú y en el inicio como si tuviera productos, y al entrar se ve este
              cartel en vez de la grilla vacía. Dejalo en blanco para que la categoría se oculte sola mientras no
              tenga productos (comportamiento de siempre).
            </p>
            <RichTextEditor
              name="comingSoonMessage"
              compact
              initialValue={initial.comingSoonMessage}
              onChange={(html) => set("comingSoonMessage", html)}
              uploadImage={async (fd) => {
                const res = await fetch("/api/admin/images", { method: "POST", body: fd });
                const data = await res.json().catch(() => ({}));
                return res.ok ? { ok: true, url: data.url } : { ok: false, error: data.error ?? "No se pudo subir" };
              }}
            />
          </div>

          <div className={card}>
            <p className="text-sm font-semibold text-brand-ink">SEO</p>
            <p className="mb-3 text-xs text-brand-muted">Cómo aparece esta categoría en Google. Si lo dejás vacío se usa el nombre.</p>
            <div className="grid gap-4">
              <div><label className={label}>Título SEO</label><input className={field} value={form.seoTitle} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} /></div>
              <div><label className={label}>Descripción SEO</label><textarea className={field} rows={2} value={form.seoDescription} maxLength={300} onChange={(e) => set("seoDescription", e.target.value)} /></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <LogoField name="imageUrl" label="Imagen de la categoría" hint="Se usa en el inicio y en los listados. Subí una imagen o dejá vacío." initialUrl={form.imageUrl} fallbackUrl={null} previewClass="h-24" onValueChange={(url) => set("imageUrl", url)} />
          <div className={card}>
            <button type="button" disabled={pending || !form.name.trim()} onClick={save} className="w-full cursor-pointer rounded-lg bg-brand-pink px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50">
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.ok ? "✓ " : ""}{msg.text}</p>}
            <div className="mt-4 border-t border-black/5 pt-3 text-sm">
              <DeleteCategoryButton id={id} name={initial.name} products={products} subcategories={subcategories} redirectTo="/admin/categorias" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
