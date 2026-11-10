import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pickActiveTheme, sanitizeThemeConfig, themeStatus, type ThemeStatus } from "@/lib/themes";
import { ThemeCardActions, NewTheme, BaseThemeCard } from "./ThemeActions";

export const dynamic = "force-dynamic";

const STATUS: Record<ThemeStatus, { text: string; cls: string }> = {
  live: { text: "● ACTIVO en la tienda", cls: "bg-green-600 text-white" },
  scheduled: { text: "Programado (todavía no se ve)", cls: "bg-blue-50 text-blue-700" },
  expired: { text: "Vencido (ya no se ve)", cls: "bg-amber-50 text-amber-700" },
  inactive: { text: "Apagado (no se ve)", cls: "bg-gray-100 text-gray-600" },
  overridden: { text: "Vigente, pero tapado por otro tema", cls: "bg-purple-50 text-purple-700" },
};

const fmt = (d: Date | null) => (d ? d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" }) : null);

export default async function TemasPage() {
  const all = await prisma.theme.findMany({ orderBy: { updatedAt: "desc" } });
  const baseTheme = all.find((t) => t.isBase) ?? null;
  const themes = all.filter((t) => !t.isBase);
  const active = pickActiveTheme(themes);
  themes.sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id));

  return (
    <div className="max-w-4xl pb-16">
      <h1 className="text-2xl font-bold text-brand-ink">Temas y campañas</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Cambiá la identidad visual de la tienda para una campaña (Navidad, Black Friday, Hot Sale…): colores, tipografía de títulos,
        botones, fondo, barra de anuncio, portada y banners. Probalo con <b>Vista previa</b> (solo lo ves vos), activalo con un clic o
        programá cuándo empieza y termina: cuando pasa la fecha, la tienda vuelve sola a su aspecto base. Se ve un solo aspecto a la vez.
      </p>

      <div className={`mt-5 rounded-xl border-2 p-5 ${active ? "border-green-600 bg-green-50" : "border-black/10 bg-white"}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Lo que ven hoy tus clientes</p>
        {active ? (
          <>
            <p className="mt-1 text-xl font-bold text-green-800">{active.name}</p>
            <p className="mt-1 text-sm text-green-900">
              {active.endsAt ? `Se apaga solo el ${fmt(active.endsAt)} y la tienda vuelve a su aspecto base.` : "No tiene fecha de fin: sigue activo hasta que lo apagues."}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-xl font-bold text-brand-ink">Aspecto base de la tienda</p>
            <p className="mt-1 text-sm text-brand-muted">No hay ninguna campaña activa, así que se muestra el aspecto base{baseTheme ? " (el que personalizaste)" : ""}. Podés editarlo en la tarjeta de abajo.</p>
          </>
        )}
      </div>

      <BaseThemeCard
        baseId={baseTheme?.id ?? null}
        colors={baseTheme ? Object.values(sanitizeThemeConfig(baseTheme.config).colors).slice(0, 4) : null}
        campaignActive={Boolean(active)}
      />

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-4 text-sm text-brand-muted">
        <p className="font-semibold text-brand-ink">Cómo funciona</p>
        <ol className="mt-1 list-decimal pl-5">
          <li>Creá un tema nuevo: queda <b>apagado</b> y se abre para que lo ajustes.</li>
          <li>Tocá <b>Guardar y activar</b> para que se vea ya (el aspecto base y cualquier otra campaña se desactivan), o cargá fechas y <b>Guardar y programar</b>.</li>
          <li>Para volver al aspecto de siempre, tocá <b>Activar aspecto base</b>: la campaña se apaga y queda guardada para usarla otra vez.</li>
        </ol>
      </div>

      <div className="mb-2 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-brand-ink">Tus campañas</h2>
        <NewTheme />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {themes.map((t) => {
          const config = sanitizeThemeConfig(t.config);
          const status = themeStatus(t, active?.id ?? null);
          return (
            <div key={t.id} className={`overflow-hidden rounded-xl border-2 bg-white ${status === "live" ? "border-green-600" : "border-black/10"}`}>
              <div className="flex h-10">
                {[config.colors.primary, config.colors.primaryDark, config.colors.ink, config.colors.soft].map((c, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/admin/temas/${t.id}`} className="font-semibold text-brand-ink hover:text-brand-pink-dark hover:underline">{t.name}</Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[status].cls}`}>{STATUS[status].text}</span>
                </div>
                {t.description && <p className="mt-1 text-xs text-brand-muted">{t.description}</p>}
                <p className="mt-2 text-xs text-brand-muted">
                  {t.startsAt || t.endsAt ? `Programado: ${fmt(t.startsAt) ?? "ya"} → ${fmt(t.endsAt) ?? "sin fin"}` : t.enabled ? "Sin fechas: activo hasta que lo desactives." : "Está guardado pero apagado: tocá Activar ahora para mostrarlo."}
                </p>
                <ThemeCardActions id={t.id} enabled={t.enabled} hasSchedule={Boolean(t.startsAt || t.endsAt)} isLive={status === "live"} expired={status === "expired"} />
              </div>
            </div>
          );
        })}
        {themes.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-brand-muted sm:col-span-2">Todavía no creaste ninguna campaña. Tocá “Crear tema nuevo” para empezar.</p>}
      </div>
    </div>
  );
}
