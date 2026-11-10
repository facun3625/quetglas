"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { createBackupNow, deleteBackupAction } from "./backupActions";

export type BackupRow = { name: string; size: number; modified: string; kind: "manual" | "auto" };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function BackupsPanel({ backups, configured, where, keep }: { backups: BackupRow[]; configured: boolean; where: "r2" | "disco"; keep: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const lastAuto = backups.find((b) => b.kind === "auto");
  const autoStale = configured && (!lastAuto || now - new Date(lastAuto.modified).getTime() > 36 * 3600 * 1000);

  function run(fn: () => Promise<{ ok: boolean; message: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="font-semibold text-brand-ink">Copias de seguridad</p>
      <p className="mt-1 text-xs text-brand-muted">
        Una copia completa de la base de datos (productos, pedidos, clientes y configuración). Van cifradas y se guardan{" "}
        {where === "r2" ? "en R2, fuera del servidor" : "en el disco del servidor (configurá R2 para guardarlas afuera)"}. Se conservan las últimas {keep}.
      </p>

      {!configured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Las copias están desactivadas: falta la variable <span className="font-mono">BACKUP_SECRET</span> en el servidor (el .env del VPS, mínimo 16 caracteres). Está explicado en el manual, sección “Copias de seguridad”.
        </p>
      ) : (
        <>
          {autoStale && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {lastAuto ? "Hace más de un día que no se hace la copia automática." : "Todavía no se hizo ninguna copia automática."} Revisá que el cron del servidor esté configurado.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(createBackupNow)}
              className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60"
            >
              {pending ? "Trabajando…" : "Hacer copia ahora"}
            </button>
            {msg && <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        </>
      )}

      <div className="mt-5 overflow-hidden rounded-lg border border-black/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-soft text-xs uppercase text-brand-muted">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Tamaño</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.name} className="border-t border-black/5">
                <td className="px-3 py-2 text-brand-ink">{fmtDate(b.modified)}</td>
                <td className="px-3 py-2 text-brand-muted">{b.kind === "auto" ? "Automática" : "Manual"}</td>
                <td className="px-3 py-2 text-brand-muted">{fmtSize(b.size)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                    <a href={`/api/admin/backups/${b.name}`} className="text-brand-pink-dark hover:underline">Descargar</a>
                    <button type="button" onClick={() => setToDelete(b.name)} className="cursor-pointer text-red-600 hover:underline">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {backups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-brand-muted">Todavía no hay copias.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Al descargar, la copia se entrega sin cifrar (.json.gz): guardala en un lugar seguro. Restaurar se hace desde el servidor con <span className="font-mono">scripts/restore-backup.mjs</span> (ver el manual).
      </p>

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Eliminar esta copia?"
        message="No se puede deshacer. Las demás copias no se tocan."
        confirmLabel="Eliminar"
        danger
        pending={pending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const name = toDelete!;
          setToDelete(null);
          run(() => deleteBackupAction(name));
        }}
      />
    </div>
  );
}
