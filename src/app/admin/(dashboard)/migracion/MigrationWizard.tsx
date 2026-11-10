"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelWooMigration,
  previewWooAction,
  sendActivationEmailsAction,
  startWooMigrationAction,
  type PreviewResult,
} from "./actions";

type Counter = { created: number; updated: number; skipped: number; failed: number };
type JobView = {
  id: string;
  status: "running" | "done" | "failed" | "cancelled";
  progress: { step: string; label: string; done: number; total: number };
  counters: Record<string, Counter>;
  issues: { level: "warning" | "error"; entity: string; ref: string; message: string }[];
  sourceUrl: string;
};

const field =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";
const card = "mt-6 rounded-xl border border-black/10 bg-white p-5";
const primary =
  "cursor-pointer rounded-lg bg-brand-pink px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-60";
const secondary = "cursor-pointer rounded-lg border border-black/10 px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-soft";

const ENTITY_LABELS: Record<string, string> = {
  categories: "Categorías",
  attributes: "Atributos",
  products: "Productos",
  variants: "Variantes",
  images: "Imágenes",
  customers: "Clientes",
};
const STATUS_TEXT: Record<JobView["status"], string> = {
  running: "En curso…",
  done: "Terminada",
  failed: "Falló",
  cancelled: "Cancelada",
};

export function MigrationWizard({
  activeJobId,
  lastJob,
  pendingActivation,
}: {
  activeJobId: string | null;
  lastJob: { id: string; sourceUrl: string } | null;
  pendingActivation: number;
}) {
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"form" | "preview">("form");
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);
  const [customers, setCustomers] = useState(true);
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }>["preview"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(activeJobId ?? lastJob?.id ?? null);
  const [job, setJob] = useState<JobView | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [activation, setActivation] = useState<{ remaining: number; message: string | null; busy: boolean }>({
    remaining: pendingActivation,
    message: null,
    busy: false,
  });
  const creds = useRef<FormData | null>(null);

  const poll = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/migration/${id}`, { cache: "no-store" });
    if (res.ok) setJob((await res.json()) as JobView);
  }, []);

  // Trae el estado al cargar y, mientras corre, cada 1,5 s
  useEffect(() => {
    if (!jobId) return;
    void poll(jobId);
  }, [jobId, poll]);
  useEffect(() => {
    if (!jobId || job?.status !== "running") return;
    const timer = setInterval(() => void poll(jobId), 1500);
    return () => clearInterval(timer);
  }, [jobId, job?.status, poll]);

  function readForm(form: HTMLFormElement) {
    const data = new FormData(form);
    creds.current = data;
    return data;
  }

  function doPreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormEl(e.currentTarget);
    const data = readForm(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await previewWooAction(data);
      if (!result.ok) return setError(result.error);
      setPreview(result.preview);
      setCustomers(result.preview.customers !== null);
      setPhase("preview");
    });
  }

  function start() {
    if (!creds.current) return;
    const data = new FormData();
    for (const [k, v] of creds.current.entries()) data.set(k, v);
    data.set("customers", customers ? "on" : "off");
    setError(null);
    startTransition(async () => {
      const result = await startWooMigrationAction(data);
      if (!result.ok) return setError(result.error);
      setJob(null);
      setJobId(result.jobId);
      setShowIssues(false);
    });
  }

  async function sendActivation() {
    setActivation((a) => ({ ...a, busy: true, message: null }));
    let totalSent = 0;
    let remaining = activation.remaining;
    for (let i = 0; i < 100 && remaining > 0; i++) {
      const result = await sendActivationEmailsAction();
      if (!result.ok) {
        setActivation({ remaining, busy: false, message: result.error });
        return;
      }
      totalSent += result.sent;
      remaining = result.remaining;
      if (result.sent === 0) break;
      setActivation({ remaining, busy: true, message: `Enviados ${totalSent}…` });
    }
    setActivation({ remaining, busy: false, message: `Se enviaron ${totalSent} mails de activación.` });
  }

  const running = job?.status === "running";
  const pct = job && job.progress.total > 0 ? Math.min(100, Math.round((job.progress.done / job.progress.total) * 100)) : 0;
  const showWizard = !running;

  return (
    <>
      {job && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-brand-ink">
              Migración {STATUS_TEXT[job.status].toLowerCase()} <span className="font-normal text-brand-muted">· {job.sourceUrl}</span>
            </p>
            {running && (
              <button className={secondary} onClick={() => void cancelWooMigration(job.id).then(() => poll(job.id))}>
                Cancelar
              </button>
            )}
          </div>

          {running && (
            <div className="mt-4">
              <p className="mb-1 text-sm text-brand-ink">
                {job.progress.label || "Conectando…"}
                {job.progress.total > 0 && <span className="text-brand-muted"> — {job.progress.done} de {job.progress.total}</span>}
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
                <div className="h-full rounded-full bg-brand-pink transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase text-brand-muted">
                <th className="py-2">Qué</th><th>Nuevos</th><th>Actualizados</th><th>Omitidos</th><th>Con error</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ENTITY_LABELS).map(([key, text]) => {
                const c = job.counters[key];
                if (!c || c.created + c.updated + c.skipped + c.failed === 0) return null;
                return (
                  <tr key={key} className="border-b border-black/5">
                    <td className="py-2 font-medium text-brand-ink">{text}</td>
                    <td>{c.created}</td><td>{c.updated}</td><td>{c.skipped}</td>
                    <td className={c.failed ? "font-semibold text-red-600" : ""}>{c.failed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {job.issues.length > 0 && (
            <div className="mt-4">
              <button className="cursor-pointer text-sm font-medium text-brand-pink-dark hover:underline" onClick={() => setShowIssues((v) => !v)}>
                {showIssues ? "Ocultar" : "Ver"} avisos y errores ({job.issues.length})
              </button>
              {showIssues && (
                <ul className="mt-2 max-h-72 space-y-1 overflow-auto rounded-lg border border-black/10 p-3 text-xs">
                  {job.issues.map((issue, i) => (
                    <li key={i} className={issue.level === "error" ? "text-red-700" : "text-amber-800"}>
                      <b>{issue.entity}</b> · {issue.ref}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {job.status === "done" && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Listo. Revisá el catálogo en Productos. Si algo no te cierra, podés volver a ejecutar la migración sin duplicar.
            </p>
          )}
          {(job.status === "failed" || job.status === "cancelled") && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {job.status === "cancelled" ? "Se canceló. Lo ya importado se conserva; " : "Se detuvo. Lo ya importado se conserva; "}
              volvé a ejecutarla (con las mismas claves) y continúa sin duplicar.
            </p>
          )}
        </div>
      )}

      {activation.remaining > 0 && !running && (
        <div className={card}>
          <p className="font-semibold text-brand-ink">Clientes migrados sin contraseña</p>
          <p className="mt-1 text-sm text-brand-muted">
            Hay <b>{activation.remaining}</b> cliente(s) que todavía no pueden entrar porque WooCommerce no permite migrar
            contraseñas. Podés enviarles un mail con un enlace (vale 7 días) para crear la suya; también pueden usar
            “¿Olvidaste tu contraseña?”. Requiere tener configurado el proveedor de correo.
          </p>
          <button className={`${primary} mt-3`} disabled={activation.busy} onClick={() => void sendActivation()}>
            {activation.busy ? "Enviando…" : "Enviar mails de activación"}
          </button>
          {activation.message && <p className="mt-2 text-sm text-brand-ink">{activation.message}</p>}
        </div>
      )}

      {showWizard && (
        <div className={card}>
          <p className="mb-4 font-semibold text-brand-ink">{job ? "Nueva ejecución" : "Conectar con la tienda"}</p>
          <form onSubmit={doPreview} className="flex flex-col gap-4">
            <div>
              <label className={label}>URL de la tienda WooCommerce</label>
              <input name="baseUrl" required placeholder="https://mitienda.com" defaultValue={lastJob?.sourceUrl ?? ""} className={field} disabled={phase === "preview"} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Consumer key</label>
                <input name="consumerKey" required placeholder="ck_…" autoComplete="off" className={field} disabled={phase === "preview"} />
              </div>
              <div>
                <label className={label}>Consumer secret</label>
                <input name="consumerSecret" type="password" required placeholder="cs_…" autoComplete="off" className={field} disabled={phase === "preview"} />
              </div>
            </div>
            <p className="text-xs text-brand-muted">
              Se generan en WooCommerce → Ajustes → Avanzado → API REST, con permiso de <b>solo lectura</b>. No se guardan:
              se usan únicamente durante la migración.
            </p>
            {phase === "form" && (
              <div>
                <button type="submit" className={primary} disabled={pending}>
                  {pending ? "Conectando…" : "Probar conexión y ver vista previa"}
                </button>
              </div>
            )}
          </form>

          {phase === "preview" && preview && (
            <div className="mt-5 border-t border-black/10 pt-5">
              <p className="text-sm font-semibold text-green-700">Conexión correcta con {preview.storeUrl}</p>
              <ul className="mt-3 grid gap-2 text-sm text-brand-ink sm:grid-cols-2">
                <li><b>{preview.products}</b> productos (se omiten los agrupados y externos)</li>
                <li><b>{preview.categories}</b> categorías</li>
                <li><b>{preview.attributes}</b> atributos globales</li>
                <li>{preview.customers === null ? "Clientes: la clave no tiene permiso para leerlos" : <><b>{preview.customers}</b> clientes</>}</li>
              </ul>
              {preview.sample.length > 0 && <p className="mt-2 text-xs text-brand-muted">Ejemplos: {preview.sample.join(" · ")}</p>}

              <label className="mt-4 flex items-center gap-2 text-sm text-brand-ink">
                <input type="checkbox" checked={customers && preview.customers !== null} disabled={preview.customers === null} onChange={(e) => setCustomers(e.target.checked)} />
                Migrar también los clientes (llegan sin contraseña)
              </label>
              <p className="mt-1 text-xs text-brand-muted">Siempre se migran categorías, atributos y productos con sus variantes e imágenes.</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button className={primary} disabled={pending} onClick={start}>
                  {pending ? "Iniciando…" : "Iniciar migración"}
                </button>
                <button className={secondary} onClick={() => { setPhase("form"); setPreview(null); formEl?.reset(); }}>
                  Cambiar datos
                </button>
              </div>
            </div>
          )}
          {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </>
  );
}
