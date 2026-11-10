"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Analysis } from "@/lib/productImport/jobs";
import type { Issue } from "@/lib/productImport/parse";

type Count = { created: number; updated: number; skipped: number; failed: number };
type Job = {
  id: string;
  fileName: string;
  status: "running" | "done" | "failed" | "cancelled";
  progress: { label?: string; done?: number; total?: number };
  counters: Partial<Record<"products" | "variants" | "images", Count>>;
  issues: Issue[];
};

const btn = "cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:cursor-default disabled:opacity-60";
const btnGhost = "cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-60";

function IssueList({ issues, max = 100 }: { issues: Issue[]; max?: number }) {
  if (!issues.length) return null;
  return (
    <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-black/10">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-brand-soft text-brand-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Fila</th>
            <th className="px-3 py-2 font-semibold">SKU</th>
            <th className="px-3 py-2 font-semibold">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {issues.slice(0, max).map((i, n) => (
            <tr key={n} className={`border-t border-black/5 ${i.level === "error" ? "text-red-700" : "text-amber-800"}`}>
              <td className="px-3 py-1.5 whitespace-nowrap">{i.row ?? "—"}</td>
              <td className="px-3 py-1.5 whitespace-nowrap">{i.sku ?? ""}</td>
              <td className="px-3 py-1.5">
                <span className="mr-1 font-semibold">{i.level === "error" ? "Error:" : "Aviso:"}</span>
                {i.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {issues.length > max && <p className="border-t border-black/5 px-3 py-2 text-xs text-brand-muted">…y {issues.length - max} más.</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-brand-soft px-3 py-2">
      <p className="text-lg font-bold text-brand-ink">{value}</p>
      <p className="text-xs text-brand-muted">{label}</p>
    </div>
  );
}

export function ExcelImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "preview" | "start">("");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const formData = (mode: "preview" | "start") => {
    const fd = new FormData();
    const file = fileRef.current?.files?.[0];
    const zip = zipRef.current?.files?.[0];
    if (file) fd.append("file", file);
    if (zip) fd.append("zip", zip);
    fd.append("mode", mode);
    return fd;
  };

  async function send(mode: "preview" | "start") {
    if (!fileRef.current?.files?.[0]) {
      setError("Elegí el archivo Excel.");
      return;
    }
    setBusy(mode);
    setError("");
    try {
      const res = await fetch("/api/admin/products/import", { method: "POST", body: formData(mode) });
      const data = await res.json().catch(() => ({ error: "Respuesta inválida del servidor" }));
      if (!res.ok) throw new Error(data.error ?? "No se pudo procesar el archivo");
      if (mode === "preview") setAnalysis(data.analysis);
      else setJob({ id: data.jobId, fileName: "", status: "running", progress: {}, counters: {}, issues: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy("");
    }
  }

  // Seguimiento del trabajo en curso
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/admin/products/import/${job.id}`, { cache: "no-store" });
      if (res.ok) setJob(await res.json());
    }, 1000);
    return () => clearInterval(t);
  }, [job?.id, job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setAnalysis(null);
    setJob(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    if (zipRef.current) zipRef.current.value = "";
  };

  if (job) {
    const pct = job.progress.total ? Math.round(((job.progress.done ?? 0) / job.progress.total) * 100) : job.status === "running" ? 0 : 100;
    const c = job.counters;
    return (
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-brand-ink">
            {job.status === "running" ? "Importando…" : job.status === "done" ? "Importación terminada" : job.status === "cancelled" ? "Importación cancelada" : "La importación falló"}
          </p>
          {job.status === "running" && (
            <button type="button" className={btnGhost} onClick={() => fetch(`/api/admin/products/import/${job.id}`, { method: "DELETE" })}>
              Cancelar
            </button>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
          <div className="h-full rounded-full bg-brand-pink transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-brand-muted">
          {job.progress.total ? `${job.progress.done ?? 0} de ${job.progress.total} productos` : "Preparando…"}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Productos creados" value={c.products?.created ?? 0} />
          <Stat label="Productos actualizados" value={c.products?.updated ?? 0} />
          <Stat label="Variantes" value={(c.variants?.created ?? 0) + (c.variants?.updated ?? 0)} />
          <Stat label="Imágenes subidas" value={c.images?.created ?? 0} />
        </div>
        {(c.products?.failed ?? 0) + (c.images?.failed ?? 0) > 0 && (
          <p className="mt-3 text-sm text-red-700">
            {c.products?.failed ? `${c.products.failed} producto(s) fallaron. ` : ""}
            {c.images?.failed ? `${c.images.failed} imagen(es) no se pudieron subir.` : ""}
          </p>
        )}
        <IssueList issues={job.issues} />
        {job.status !== "running" && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/productos" className={btn}>Ver productos</Link>
            <button type="button" className={btnGhost} onClick={reset}>Importar otro archivo</button>
          </div>
        )}
      </div>
    );
  }

  const s = analysis?.summary;
  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-brand-ink">Excel de productos (.xlsx)</span>
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="w-full text-sm" onChange={() => setAnalysis(null)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-brand-ink">Imágenes en .zip <span className="font-normal text-brand-muted">(opcional)</span></span>
          <input ref={zipRef} type="file" accept=".zip,application/zip" className="w-full text-sm" onChange={() => setAnalysis(null)} />
          <span className="mt-1 block text-xs text-brand-muted">Solo si en la columna imagenes pusiste nombres de archivo en vez de links.</span>
        </label>
      </div>

      {!analysis && (
        <button type="button" className={`${btn} mt-5`} disabled={busy !== ""} onClick={() => send("preview")}>
          {busy === "preview" ? "Revisando…" : "Revisar archivo"}
        </button>
      )}
      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {analysis && s && (
        <div className="mt-5 border-t border-black/5 pt-5">
          <p className="text-sm font-semibold text-brand-ink">Vista previa — todavía no se guardó nada</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Productos nuevos" value={s.create} />
            <Stat label="Productos a actualizar" value={s.update} />
            <Stat label="Variantes" value={s.variantsCreate + s.variantsUpdate} />
            <Stat label="Imágenes" value={s.images} />
          </div>
          {s.categories.length > 0 && (
            <p className="mt-3 text-xs text-brand-muted">
              <b>Categorías</b> (las que no existen se crean): {s.categories.join(" · ")}
            </p>
          )}
          {s.attributes.length > 0 && (
            <p className="mt-1 text-xs text-brand-muted">
              <b>Atributos de variantes:</b> {s.attributes.join(", ")}
            </p>
          )}
          {analysis.sample.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-brand-ink">
              {analysis.sample.map((p) => (
                <li key={p.sku}>
                  <span className="text-brand-muted">{p.sku}</span> — {p.name || <i className="text-brand-muted">(sin cambio de nombre)</i>}
                  {p.kind === "variable" && <span className="text-brand-muted"> · {p.variants} variantes</span>}
                </li>
              ))}
              {analysis.toImport > analysis.sample.length && <li className="text-brand-muted">…y {analysis.toImport - analysis.sample.length} más</li>}
            </ul>
          )}

          {analysis.errors > 0 && (
            <p className="mt-4 text-sm text-red-700">
              {analysis.errors} error(es): esas filas <b>no se importan</b>. Podés corregir el Excel y volver a revisarlo, o importar igual lo que está bien.
            </p>
          )}
          {analysis.warnings > 0 && <p className="mt-1 text-sm text-amber-800">{analysis.warnings} aviso(s): se importa igual, revisalos.</p>}
          <IssueList issues={analysis.issues} />

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className={btn} disabled={busy !== "" || analysis.toImport === 0} onClick={() => send("start")}>
              {busy === "start" ? "Iniciando…" : `Importar ${analysis.toImport} producto(s)`}
            </button>
            <button type="button" className={btnGhost} disabled={busy !== ""} onClick={() => send("preview")}>
              Volver a revisar
            </button>
            <button type="button" className={btnGhost} disabled={busy !== ""} onClick={reset}>
              Cambiar archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
