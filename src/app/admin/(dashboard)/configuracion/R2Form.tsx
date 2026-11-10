"use client";

import { useRef, useState, useTransition } from "react";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { testR2Settings, updateR2Settings } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";

export function R2Form({
  initial,
  source,
}: {
  initial: { accountId: string; bucket: string; publicUrl: string; hasAccessKey: boolean; hasSecret: boolean };
  source: "panel" | "entorno" | "disco";
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function values(): Record<string, string> {
    const f = new FormData(ref.current!);
    return Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  }

  const SOURCE_TEXT = {
    panel: { cls: "bg-green-50 text-green-800", text: "Usando R2 con la configuración de este panel." },
    entorno: { cls: "bg-green-50 text-green-800", text: "Usando R2 con las variables del servidor (R2_*). Si cargás los datos acá, tienen prioridad." },
    disco: { cls: "bg-amber-50 text-amber-800", text: "R2 no está configurado: las imágenes y videos se guardan en el disco del servidor. Sirve para probar, no para producción." },
  }[source];

  return (
    <form ref={ref} onSubmit={(e) => e.preventDefault()} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="font-semibold text-brand-ink">Imágenes y videos (Cloudflare R2)</p>
      <p className="mt-1 text-xs text-brand-muted">
        Dónde se guardan las fotos de los productos, los logos, los slides y los videos. Los datos los sacás de tu cuenta de Cloudflare (R2).
      </p>
      <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${SOURCE_TEXT.cls}`}>{SOURCE_TEXT.text}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Account ID</label>
          <input name="r2AccountId" defaultValue={initial.accountId} placeholder="32 caracteres, de tu cuenta de Cloudflare" className={`${field} font-mono`} autoComplete="off" />
        </div>
        <div>
          <label className={label}>Nombre del bucket</label>
          <input name="r2Bucket" defaultValue={initial.bucket} placeholder="tienda-imagenes" className={field} autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <label className={label}>URL pública del bucket</label>
          <input name="r2PublicUrl" defaultValue={initial.publicUrl} placeholder="https://img.tudominio.com" className={field} autoComplete="off" />
          <p className="mt-1 text-xs text-brand-muted">El dominio público con el que se ven los archivos (un dominio propio o el r2.dev de Cloudflare). Sin barra al final.</p>
        </div>
        <MaskedCredentialField name="r2AccessKeyId" label="Access Key ID" configured={initial.hasAccessKey} placeholder="Clave de acceso" />
        <MaskedCredentialField name="r2SecretAccessKey" label="Secret Access Key" configured={initial.hasSecret} placeholder="Clave secreta" type="password" />
      </div>
      <p className="mt-2 text-xs text-brand-muted">Las claves se guardan en el servidor y nunca se envían de vuelta al navegador. Dejarlas vacías no las borra.</p>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { const r = await updateR2Settings(values()); setMsg({ ok: r.ok, text: r.message }); })}
          className="cursor-pointer rounded-lg bg-brand-pink px-5 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-60"
        >
          {pending ? "Un momento…" : "Guardar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { setMsg({ ok: true, text: "Probando la conexión…" }); const r = await testR2Settings(values()); setMsg({ ok: r.ok, text: r.message }); })}
          className="cursor-pointer rounded-lg border border-black/10 px-5 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-60"
        >
          Probar conexión
        </button>
        {source === "panel" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => { const r = await updateR2Settings({ r2Clear: "on" }); setMsg({ ok: r.ok, text: r.message }); })}
            className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-brand-muted hover:text-red-600"
          >
            Borrar esta configuración
          </button>
        )}
      </div>
      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
      <p className="mt-3 text-xs text-brand-muted">Lo que ya está subido no se mueve solo: las imágenes nuevas van a R2, y las que estaban en el servidor siguen donde están hasta que las vuelvas a subir.</p>
    </form>
  );
}
