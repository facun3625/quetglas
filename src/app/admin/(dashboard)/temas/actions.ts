"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { createBaseTheme, ensureBaseTheme } from "@/lib/baseTheme";
import { DEFAULT_THEME_CONFIG, isThemeLive, sanitizeThemeConfig, type ThemeConfig } from "@/lib/themes";

export type ThemeInput = { id?: string; name: string; description: string; startsAt: string; endsAt: string; config: ThemeConfig };

const toDate = (v: string): Date | null => {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function refresh() {
  revalidatePath("/admin/temas");
  revalidatePath("/", "layout");
}

// Solo puede haber un aspecto a la vez: al activar uno, se apagan las campañas que se estaban viendo (las programadas
// para más adelante quedan como estaban). Activar el aspecto base es apagar todas las que se ven ahora.
async function switchOffLiveCampaigns(exceptId?: string) {
  const enabled = await prisma.theme.findMany({ where: { enabled: true, isBase: false, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true, enabled: true, startsAt: true, endsAt: true } });
  const liveIds = enabled.filter((t) => isThemeLive(t)).map((t) => t.id);
  if (liveIds.length) await prisma.theme.updateMany({ where: { id: { in: liveIds } }, data: { enabled: false } });
}

// "Activar" el aspecto base: apaga la campaña que se ve y la tienda vuelve a su aspecto de siempre.
export async function activateBaseTheme() {
  await requireAdmin();
  await switchOffLiveCampaigns();
  await logAdminAction("theme.activate", { detail: "Aspecto base" });
  refresh();
}

// activate = "Guardar y activar": además de guardar, deja el tema encendido. Sin fechas queda vigente desde ya (y pasa
// por encima de los demás); con fechas entra y sale solo según ellas.
// Abre (y crea la primera vez) el aspecto base: el que se ve cuando no hay ninguna campaña vigente.
export async function openBaseTheme(): Promise<{ id: string }> {
  await requireAdmin();
  const existing = (await ensureBaseTheme()) ?? (await createBaseTheme());
  refresh();
  return { id: existing.id };
}

// Vuelve el aspecto base a como venía de fábrica
export async function resetBaseTheme(id: string) {
  await requireAdmin();
  await prisma.theme.updateMany({ where: { id, isBase: true }, data: { config: DEFAULT_THEME_CONFIG as object } });
  await logAdminAction("theme.save", { targetType: "theme", targetId: id, detail: "Aspecto base restablecido" });
  refresh();
}

export async function saveTheme(input: ThemeInput, activate = false): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin();
  const isBase = input.id ? Boolean((await prisma.theme.findUnique({ where: { id: input.id }, select: { isBase: true } }))?.isBase) : false;
  if (isBase) {
    // El aspecto base vale siempre: no tiene fechas ni se activa/apaga
    const base = await prisma.theme.update({ where: { id: input.id! }, data: { config: sanitizeThemeConfig(input.config) as object, startsAt: null, endsAt: null, enabled: true } });
    await logAdminAction("theme.save", { targetType: "theme", targetId: base.id, detail: "Aspecto base" });
    refresh();
    return { ok: true, id: base.id };
  }
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Poné un nombre al tema" };
  const startsAt = toDate(input.startsAt);
  const endsAt = toDate(input.endsAt);
  if (input.startsAt?.trim() && !startsAt) return { ok: false, error: "La fecha de inicio no es válida" };
  if (input.endsAt?.trim() && !endsAt) return { ok: false, error: "La fecha de fin no es válida" };
  if (startsAt && endsAt && endsAt <= startsAt) return { ok: false, error: "El fin tiene que ser posterior al inicio" };

  if (activate && endsAt && endsAt <= new Date()) return { ok: false, error: "La fecha de fin ya pasó: corregila para poder activarlo" };

  const data = { name, description: input.description.trim().slice(0, 300) || null, startsAt, endsAt, config: sanitizeThemeConfig(input.config) as object, ...(activate ? { enabled: true, startsAt: startsAt ?? new Date() } : {}) };
  const theme = input.id ? await prisma.theme.update({ where: { id: input.id }, data }) : await prisma.theme.create({ data });
  if (activate) await switchOffLiveCampaigns(theme.id);
  await logAdminAction(activate ? "theme.activate" : "theme.save", { targetType: "theme", targetId: theme.id, detail: name });
  refresh();
  return { ok: true, id: theme.id };
}

// "Activar ahora": queda vigente desde este momento (y pasa por encima de otros temas que hayan empezado antes).
// Si tenía una fecha de fin ya vencida, se la saca para que no se apague al instante.
export async function activateTheme(id: string) {
  await requireAdmin();
  const theme = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true, endsAt: true } });
  if (!theme) return;
  await prisma.theme.update({ where: { id }, data: { enabled: true, startsAt: new Date(), endsAt: theme.endsAt && theme.endsAt > new Date() ? theme.endsAt : null } });
  await switchOffLiveCampaigns(id);
  await logAdminAction("theme.activate", { targetType: "theme", targetId: id, detail: theme.name });
  refresh();
}

export async function deactivateTheme(id: string) {
  await requireAdmin();
  const theme = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true } });
  if (!theme) return;
  await prisma.theme.update({ where: { id }, data: { enabled: false } });
  await logAdminAction("theme.deactivate", { targetType: "theme", targetId: id, detail: theme.name });
  refresh();
}

// Deja el tema "armado" para que entre y salga solo según sus fechas (necesita inicio o fin cargado en el editor)
export async function scheduleTheme(id: string) {
  await requireAdmin();
  await prisma.theme.updateMany({ where: { id, isBase: false }, data: { enabled: true } });
  refresh();
}

export async function duplicateTheme(id: string): Promise<{ id: string } | null> {
  await requireAdmin();
  const t = await prisma.theme.findUnique({ where: { id } });
  if (!t) return null;
  const copy = await prisma.theme.create({ data: { name: `Copia de ${t.name}`.slice(0, 80), description: t.description, config: t.config as object, enabled: false } });
  refresh();
  return { id: copy.id };
}

export async function deleteTheme(id: string) {
  await requireAdmin();
  const t = await prisma.theme.findFirst({ where: { id, isBase: false }, select: { name: true } });
  if (!t) return;
  await prisma.theme.delete({ where: { id } });
  await logAdminAction("theme.delete", { targetType: "theme", targetId: id, detail: t.name });
  refresh();
}

// ---------- Verificación de enlaces de video ----------

function isPrivateHost(host: string): boolean {
  return /^(localhost|.*\.local|.*\.internal)$/i.test(host) || /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1|fc|fd|fe80)/i.test(host);
}

// Mira de verdad qué hay detrás del enlace (los primeros bytes) para avisar en el panel si NO es un video:
// una página web, un archivo caído, un permiso mal puesto, etc. Solo para administradores.
export async function probeVideo(url: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const { checkVideoUrl } = await import("@/lib/video");
  const { detectVideoType } = await import("@/lib/storage");
  const { lookup } = await import("node:dns/promises");
  const checked = checkVideoUrl(url);
  if ("error" in checked) return { ok: false, message: checked.error };
  if (checked.source === "propio") return { ok: true, message: "Video subido a la tienda." };

  try {
    const target = new URL(checked.url);
    if (isPrivateHost(target.hostname)) return { ok: false, message: "Ese enlace no es válido." };
    const addrs = await lookup(target.hostname, { all: true }).catch(() => []);
    if (addrs.length === 0 || addrs.some((a) => isPrivateHost(a.address))) return { ok: false, message: "No se pudo encontrar ese sitio." };

    const res = await fetch(target, { headers: { Range: "bytes=0-2047" }, redirect: "follow", signal: AbortSignal.timeout(10000) });
    if (!res.ok && res.status !== 206) {
      return { ok: false, message: res.status === 403 || res.status === 401 ? "El enlace no es público (permiso denegado). Compartilo como “cualquiera con el enlace”." : `No se pudo abrir el enlace (error ${res.status}).` };
    }
    const type = res.headers.get("content-type") ?? "";
    const head = Buffer.from(await res.arrayBuffer()).subarray(0, 2048);
    if (detectVideoType(head)) {
      const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1] ?? res.headers.get("content-length");
      const mb = total ? ` (${(Number(total) / 1048576).toFixed(1)} MB)` : "";
      return { ok: true, message: `Es un video${mb}.` };
    }
    if (/text\/html/i.test(type)) return { ok: false, message: "Ese enlace abre una página web, no el archivo del video. Si es de Drive, revisá que esté compartido como “cualquiera con el enlace”; si es muy pesado, subilo desde acá." };
    return { ok: false, message: "El enlace no parece un video .mp4 o .webm. Probá subirlo desde acá." };
  } catch {
    return { ok: false, message: "No se pudo comprobar el enlace (tardó demasiado o no responde)." };
  }
}
