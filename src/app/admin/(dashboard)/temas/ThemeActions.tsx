"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { activateBaseTheme, activateTheme, openBaseTheme, resetBaseTheme, deactivateTheme, deleteTheme, duplicateTheme, scheduleTheme } from "./actions";
import { useConfirm } from "@/lib/useConfirm";

const btn = "cursor-pointer rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft disabled:opacity-50";
// Botón principal: no hereda el hover claro de `btn` (si no, el texto blanco queda invisible al pasar el mouse)
const btnPrimary = "cursor-pointer rounded-lg border border-transparent bg-brand-pink px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-pink-dark disabled:opacity-50";

export function ThemeCardActions({ id, enabled, hasSchedule, isLive, expired }: { id: string; enabled: boolean; hasSchedule: boolean; isLive: boolean; expired?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {dialog}
      <a href={`/api/admin/themes/preview?id=${id}`} className={btn}>Vista previa</a>
      <Link href={`/admin/temas/${id}`} className={btn}>Editar</Link>
      {enabled ? (
        <>
          {expired && (
            <button disabled={pending} className={btnPrimary} title="Quita la fecha de fin vencida y lo muestra desde ahora" onClick={() => start(async () => { await activateTheme(id); router.refresh(); })}>
              Reactivar
            </button>
          )}
          <button disabled={pending} className={btn} onClick={() => start(async () => { await deactivateTheme(id); router.refresh(); })}>Apagar</button>
        </>
      ) : (
        <>
          <button disabled={pending} className={btnPrimary} onClick={() => start(async () => { await activateTheme(id); router.refresh(); })}>
            Activar ahora
          </button>
          {hasSchedule && (
            <button disabled={pending} className={btn} title="Entra y sale solo según sus fechas" onClick={() => start(async () => { await scheduleTheme(id); router.refresh(); })}>
              Programar
            </button>
          )}
        </>
      )}
      <button disabled={pending} className={btn} onClick={() => start(async () => { const copy = await duplicateTheme(id); if (copy) router.push(`/admin/temas/${copy.id}`); })}>Duplicar</button>
      <button
        disabled={pending}
        className={`${btn} text-red-600`}
        onClick={async () => (await confirm(isLive ? { title: "¿Eliminar el tema activo?", message: "Este tema se está mostrando ahora: la tienda vuelve a su aspecto base.", danger: true } : { title: "¿Eliminar este tema?", danger: true })) && start(async () => { await deleteTheme(id); router.refresh(); })}
      >
        Eliminar
      </button>
    </div>
  );
}

export function NewTheme() {
  return (
    <Link href="/admin/temas/nuevo" className={btnPrimary}>
      + Crear tema nuevo
    </Link>
  );
}

// Aspecto base: lo que se ve cuando no hay ninguna campaña activa. Se edita acá; no tiene fechas ni se puede borrar. Si hay una campaña activa, "Activar aspecto base" la apaga y vuelve a este aspecto.
export function BaseThemeCard({ baseId, colors, campaignActive }: { baseId: string | null; colors: string[] | null; campaignActive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, dialog] = useConfirm();
  return (
    <div className={`mt-6 rounded-xl border bg-white p-4 sm:p-5 ${campaignActive ? "border-black/10" : "border-green-600/50 ring-1 ring-green-600/20"}`}>
      {dialog}
      <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap">
        {colors && (
          <div className="grid h-14 w-14 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-black/10">
            {colors.slice(0, 4).map((c, i) => (
              <div key={i} style={{ backgroundColor: c }} />
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-brand-ink">Aspecto base de la tienda</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${campaignActive ? "bg-gray-100 text-gray-600" : "bg-green-600 text-white"}`}>
              {campaignActive ? "Desactivado (hay una campaña activa)" : "● ACTIVO en la tienda"}
            </span>
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            Es el aspecto de siempre: se ve cuando no hay ninguna campaña activa. Cambiale colores, tipografía, barra de anuncio, portada y banners.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {campaignActive && (
              <button disabled={pending} className={btnPrimary} title="Apaga la campaña que se está viendo y vuelve al aspecto base" onClick={() => start(async () => { await activateBaseTheme(); router.refresh(); })}>
                Activar aspecto base
              </button>
            )}
            {baseId && <a href={`/api/admin/themes/preview?id=${baseId}`} className={btn}>Vista previa</a>}
            <button
              disabled={pending}
              className={campaignActive ? btn : btnPrimary}
              onClick={() => start(async () => { const { id } = await openBaseTheme(); router.push(`/admin/temas/${id}`); })}
            >
              Editar aspecto base
            </button>
            {baseId && (
              <button
                disabled={pending}
                className={btn}
                onClick={async () =>
                  (await confirm({ title: "¿Restablecer el aspecto base?", message: "Vuelve a los colores y estilos originales de la tienda.", confirmLabel: "Restablecer", danger: true })) &&
                  start(async () => { await resetBaseTheme(baseId); router.refresh(); })
                }
              >
                Restablecer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
