"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/lib/useConfirm";
import { addTerms, deleteTerm, renameAttribute, updateTerm } from "../actions";
import { DeleteAttributeButton } from "../DeleteAttributeButton";

type Term = { id: string; name: string; colorHex: string; variants: number };

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const PAGE = 50;

// Un atributo y sus valores (estilo WordPress): nombre editable, buscador, lista paginada con edición en línea y alta de valores.
export function TermsManager({ attribute, terms }: { attribute: { id: string; name: string; products: number }; terms: Term[] }) {
  const router = useRouter();
  const [confirm, dialog] = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState(attribute.name);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", colorHex: "" });
  const [newText, setNewText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? terms.filter((t) => t.name.toLowerCase().includes(q)) : terms;
  }, [terms, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.message ? { ok: true, text: r.message } : null) : { ok: false, text: r.error ?? "No se pudo completar." });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="mt-4">
      {dialog}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-muted">Nombre del atributo</label>
          <div className="flex gap-2">
            <input className={`${field} w-72`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <button
              type="button"
              disabled={pending || !name.trim() || name.trim() === attribute.name}
              onClick={() => run(() => renameAttribute(attribute.id, name))}
              className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-40"
            >
              Guardar nombre
            </button>
          </div>
        </div>
        <p className="text-sm text-brand-muted">
          {terms.length} valor{terms.length === 1 ? "" : "es"} · usado en {attribute.products} producto{attribute.products === 1 ? "" : "s"} ·{" "}
          <span className="text-sm"><DeleteAttributeButton id={attribute.id} name={attribute.name} products={attribute.products} redirectTo="/admin/atributos" /></span>
        </p>
      </div>

      {msg && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="font-semibold text-brand-ink">Agregar valores</p>
          <p className="mt-1 text-xs text-brand-muted">Uno por línea. Para un color: <code>Rojo|#ff0000</code>.</p>
          <textarea className={`${field} mt-3`} rows={5} value={newText} onChange={(e) => setNewText(e.target.value)} placeholder={"S\nM\nL"} />
          <button
            type="button"
            disabled={pending || !newText.trim()}
            onClick={() => run(() => addTerms(attribute.id, newText), () => setNewText(""))}
            className="mt-3 cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-40"
          >
            Agregar
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 p-3">
            <input
              className={`${field} max-w-xs`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar valor…"
            />
            <span className="text-xs text-brand-muted">{filtered.length} de {terms.length}</span>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-brand-soft/40 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2.5 font-semibold">Valor</th>
                <th className="px-4 py-2.5 font-semibold">Color</th>
                <th className="px-4 py-2.5 font-semibold">Variantes</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const isEditing = editing === t.id;
                return (
                  <tr key={t.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/30">
                    <td className="px-4 py-2">
                      {isEditing ? <input className={field} value={draft.name} maxLength={80} autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} /> : <span className="font-medium text-brand-ink">{t.name}</span>}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input type="color" value={draft.colorHex || "#ffffff"} onChange={(e) => setDraft({ ...draft, colorHex: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-black/10 p-0.5" />
                          {draft.colorHex && <button type="button" onClick={() => setDraft({ ...draft, colorHex: "" })} className="cursor-pointer text-xs text-brand-muted hover:underline">sin color</button>}
                        </div>
                      ) : t.colorHex ? (
                        <span className="inline-flex items-center gap-2 text-xs text-brand-muted"><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: t.colorHex }} />{t.colorHex}</span>
                      ) : (
                        <span className="text-brand-muted/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-brand-muted">{t.variants}</td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <span className="flex justify-end gap-3 text-xs font-semibold">
                          <button type="button" disabled={pending} onClick={() => run(() => updateTerm(t.id, draft), () => setEditing(null))} className="cursor-pointer text-brand-pink-dark hover:underline">Guardar</button>
                          <button type="button" onClick={() => setEditing(null)} className="cursor-pointer text-brand-muted hover:underline">Cancelar</button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-3 text-xs font-semibold">
                          <button type="button" onClick={() => { setEditing(t.id); setDraft({ name: t.name, colorHex: t.colorHex }); }} className="cursor-pointer text-brand-pink-dark hover:underline">Editar</button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: `¿Eliminar el valor “${t.name}”?`,
                                message: t.variants > 0 ? `Lo usan ${t.variants} variante${t.variants === 1 ? "" : "s"}: se eliminan también. No se puede deshacer.` : "No se puede deshacer.",
                                danger: true,
                              });
                              if (ok) run(() => deleteTerm(t.id));
                            }}
                            className="cursor-pointer text-red-600 hover:underline"
                          >
                            Eliminar
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-brand-muted">{query ? "Ningún valor coincide." : "Este atributo todavía no tiene valores. Agregalos a la izquierda."}</td></tr>
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-black/10 px-4 py-2.5 text-xs text-brand-muted">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="cursor-pointer font-semibold hover:text-brand-ink disabled:opacity-30">← Anterior</button>
              <span>Página {current + 1} de {pages}</span>
              <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="cursor-pointer font-semibold hover:text-brand-ink disabled:opacity-30">Siguiente →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
