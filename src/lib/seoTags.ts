// SEO y etiquetas de seguimiento: validación de lo que carga el admin y lectura de sus etiquetas propias.
// Todo lo que llega al sitio pasa por acá: los IDs se validan por formato y el código propio solo admite
// <meta>, <link> y <script> (sin atributos on*, y con src solo por https).

export const cleanGaId = (v: string) => (/^G-[A-Z0-9]{4,16}$/i.test(v.trim()) ? v.trim().toUpperCase() : null);
export const cleanGtmId = (v: string) => (/^GTM-[A-Z0-9]{4,12}$/i.test(v.trim()) ? v.trim().toUpperCase() : null);
export const cleanPixelId = (v: string) => (/^\d{8,20}$/.test(v.trim()) ? v.trim() : null);

// Acepta el código solo o la etiqueta completa (<meta name="google-site-verification" content="xxxx" />)
export function cleanVerificationCode(v: string): string | null {
  const raw = v.trim();
  const fromTag = /content\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1];
  const code = (fromTag ?? raw).trim();
  return /^[A-Za-z0-9_-]{8,120}$/.test(code) ? code : null;
}

export type CustomTag = { kind: "meta" | "link" | "script"; attrs: Record<string, string>; inline?: string };

const ATTR_RE = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function readAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (name.startsWith("on") || name === "style" || name === "srcdoc") continue;
    attrs[name] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return attrs;
}

const httpsOnly = (u: string | undefined) => Boolean(u && /^https:\/\//i.test(u.trim()));

// Devuelve las etiquetas admitidas y cuántas se descartaron por traer un enlace que no es https (otras clases de etiqueta se omiten sin avisar)
export function parseCustomTags(html: string | null | undefined): { tags: CustomTag[]; ignored: number } {
  const text = (html ?? "").slice(0, 10_000).replace(/<!--[\s\S]*?-->/g, "");
  const tags: CustomTag[] = [];
  let ignored = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<(meta|link)\b([^>]*?)\/?>|<(?!\/|script\b)([a-zA-Z][\w-]*)\b[^>]*>/gi;
  for (const m of text.matchAll(re)) {
    if (m[5]) continue; // cualquier otra etiqueta (noscript, iframe, img…) no se carga
    if (m[1] !== undefined) {
      const attrs = readAttrs(m[1]);
      if (attrs.src !== undefined) {
        if (!httpsOnly(attrs.src)) { ignored++; continue; }
        tags.push({ kind: "script", attrs });
      } else if (m[2].trim()) tags.push({ kind: "script", attrs, inline: m[2] });
      continue;
    }
    const kind = m[3].toLowerCase() as "meta" | "link";
    const attrs = readAttrs(m[4]);
    if (kind === "link" && !httpsOnly(attrs.href)) { ignored++; continue; }
    if (kind === "meta" && Object.keys(attrs).length === 0) continue;
    tags.push({ kind, attrs });
  }
  return { tags: tags.slice(0, 30), ignored };
}
