"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewUndoMigrationAction, undoMigrationAction } from "./actions";

type Preview = Awaited<ReturnType<typeof previewUndoMigrationAction>>;

// Zona de peligro (solo superadministrador): deshace la migración borrando todo lo que trajo de WooCommerce.
export function UndoMigration() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [customers, setCustomers] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const empty = preview && preview.products + preview.categories + preview.attributes + preview.customersDeletable + preview.jobs === 0;

  return (
    <div className="mt-10 rounded-xl border border-red-200 bg-red-50/40 p-5">
      <p className="font-semibold text-red-800">Zona de peligro — deshacer la migración</p>
      <p className="mt-1 text-sm text-brand-muted">
        Por si la migración no salió bien: borra <b>todo lo que se trajo de WooCommerce</b> (productos con sus variantes e imágenes, categorías,
        atributos y etiquetas que queden sin uso) y los archivos de imágenes de R2, para empezar de cero. Lo que cargaste a mano no se toca. Solo lo ve el superadministrador.
      </p>

      {!preview ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { setMsg(null); setPreview(await previewUndoMigrationAction()); })}
          className="mt-4 cursor-pointer rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Calculando…" : "Ver qué se borraría"}
        </button>
      ) : (
        <div className="mt-4">
          {empty ? (
            <p className="rounded-lg bg-white px-3 py-2 text-sm text-brand-ink">No hay nada migrado para borrar.</p>
          ) : (
            <>
              <ul className="rounded-lg border border-red-200 bg-white p-4 text-sm text-brand-ink">
                <li><b>{preview.products}</b> productos (con sus variantes)</li>
                <li><b>{preview.images}</b> imágenes (y sus miniaturas, también en R2)</li>
                <li><b>{preview.categories}</b> categorías</li>
                <li><b>{preview.attributes}</b> atributos de Woo (y los que queden sin uso)</li>
                <li><b>{preview.jobs}</b> registros del historial de migración</li>
                <li className="mt-2 flex items-start gap-2">
                  <input id="undo-customers" type="checkbox" checked={customers} onChange={(e) => setCustomers(e.target.checked)} className="mt-1" />
                  <label htmlFor="undo-customers">
                    También los <b>{preview.customersDeletable}</b> clientes migrados que no compraron ni tienen puntos
                    {preview.customersKept > 0 && <span className="text-brand-muted"> ({preview.customersKept} se conservan porque ya tienen compras, puntos o son administradores)</span>}
                  </label>
                </li>
              </ul>
              {preview.orderItemsAffected > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Atención: {preview.orderItemsAffected} líneas de pedidos ya hechos refieren a estos productos. Los pedidos se conservan con su detalle, pero esas líneas dejan de enlazar al producto.
                </p>
              )}
              <p className="mt-4 text-sm text-brand-ink">Esto <b>no se puede deshacer</b>. Para confirmar, escribí <code className="rounded bg-white px-1.5 py-0.5 font-mono">BORRAR MIGRACION</code>:</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="BORRAR MIGRACION"
                  autoComplete="off"
                  className="w-64 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={pending || confirm.trim().toUpperCase() !== "BORRAR MIGRACION"}
                  onClick={() =>
                    start(async () => {
                      const r = await undoMigrationAction({ confirm, customers });
                      if (!r.ok) return setMsg({ ok: false, text: r.error });
                      const x = r.result;
                      setMsg({
                        ok: true,
                        text: `Listo: se borraron ${x.products} productos, ${x.categories} categorías, ${x.attributes} atributos y ${x.filesDeleted} archivos de imágenes${x.filesFailed ? ` (${x.filesFailed} archivos no se pudieron borrar: revisá el bucket)` : ""}${customers ? `, y ${x.customersDeletable} clientes` : ""}.`,
                      });
                      setPreview(null);
                      setConfirm("");
                      router.refresh();
                    })
                  }
                  className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Borrando…" : "Borrar todo lo migrado"}
                </button>
                <button type="button" onClick={() => { setPreview(null); setConfirm(""); }} className="cursor-pointer text-sm text-brand-muted hover:underline">Cancelar</button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
