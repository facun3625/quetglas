import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getStoreSettingsRow } from "@/lib/settings";
import { resolveLogos } from "@/lib/logo";

// Ícono de la app instalada (Android/iPhone/PC): sale del favicon que se carga en Configuración → General → Logo e íconos y,
// si no hay ninguno (o no se puede leer), del ícono por defecto del proyecto. Se arma a medida (192 y 512 px, y una versión
// "maskable" con margen para que Android no le recorte nada), así sirve cualquier imagen que se haya subido.
const DEFAULT_ICON = path.join(process.cwd(), "public", "icons", "default-icon.png");
const BACKGROUND = "#ffffff";

export type IconSpec = { size: 192 | 512; maskable: boolean };

export function parseIconName(name: string): IconSpec | null {
  const match = /^(192|512)(-maskable)?\.png$/.exec(name);
  if (!match) return null;
  const maskable = Boolean(match[2]);
  if (maskable && match[1] !== "512") return null;
  return { size: Number(match[1]) as 192 | 512, maskable };
}

// Cambia cuando cambia el favicon: se agrega a las direcciones de los íconos para que los navegadores no sigan usando el viejo
export function iconVersion(faviconUrl: string | null): string {
  return createHash("sha1").update(faviconUrl ?? "default").digest("hex").slice(0, 8);
}

async function loadSource(url: string | null): Promise<Buffer> {
  if (url) {
    try {
      if (url.startsWith("/api/uploads/")) return await readFile(path.join(process.cwd(), "public", "uploads", url.replace(/^\/api\/uploads\//, "")));
      if (/^https:\/\//.test(url)) {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    } catch {
      /* se usa el ícono por defecto */
    }
  }
  return readFile(DEFAULT_ICON);
}

const cache = new Map<string, { at: number; png: Buffer }>();
const TTL_MS = 10 * 60 * 1000;

export async function renderAppIcon(spec: IconSpec): Promise<Buffer> {
  const { favicon } = resolveLogos(await getStoreSettingsRow());
  const key = `${favicon ?? "default"}|${spec.size}|${spec.maskable}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.png;

  const source = await loadSource(favicon);
  // La versión maskable deja un margen del 15% por lado (zona segura de Android); la común aprovecha casi todo el cuadro
  const inner = Math.round(spec.size * (spec.maskable ? 0.7 : 0.88));
  const offset = Math.floor((spec.size - inner) / 2);
  let png: Buffer;
  try {
    const glyph = await sharp(source).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    png = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: BACKGROUND } })
      .composite([{ input: glyph, left: offset, top: offset }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    // Imagen que no se puede procesar: se usa la de siempre
    const glyph = await sharp(await readFile(DEFAULT_ICON)).resize(inner, inner, { fit: "contain", background: BACKGROUND }).png().toBuffer();
    png = await sharp({ create: { width: spec.size, height: spec.size, channels: 4, background: BACKGROUND } }).composite([{ input: glyph, left: offset, top: offset }]).png().toBuffer();
  }
  if (cache.size > 30) cache.clear();
  cache.set(key, { at: Date.now(), png });
  return png;
}
