// De dónde llega cada visita: se deduce de los parámetros UTM del link (utm_source, utm_medium, utm_campaign), de la página que
// refirió (document.referrer), de los identificadores de clic de las redes (fbclid, gclid…) y, si no hay nada de eso, del
// navegador interno de la app (Instagram, Facebook y TikTok abren los links en su propio navegador y se identifican ahí).

export type Channel =
  | "instagram" | "facebook" | "whatsapp" | "tiktok" | "youtube" | "x" | "pinterest" | "linkedin"
  | "google" | "buscadores" | "email" | "push" | "otro" | "sitio" | "directo";

export type TrafficSource = { channel: Channel; paid: boolean; campaign: string | null; referrerHost: string | null };

export type TrafficInput = {
  referrer?: string | null;
  search?: string | null; // location.search de la primera página
  userAgent?: string | null;
  siteHost?: string | null; // host de esta tienda: un referrer propio no cuenta como origen
};

const UTM_SOURCES: Record<string, Channel> = {
  instagram: "instagram", ig: "instagram", insta: "instagram",
  facebook: "facebook", fb: "facebook", meta: "facebook", messenger: "facebook",
  whatsapp: "whatsapp", wa: "whatsapp", wsp: "whatsapp",
  tiktok: "tiktok", tt: "tiktok",
  youtube: "youtube", yt: "youtube",
  twitter: "x", x: "x", pinterest: "pinterest", linkedin: "linkedin",
  google: "google", bing: "buscadores", duckduckgo: "buscadores", yahoo: "buscadores",
  email: "email", mail: "email", newsletter: "email", mailing: "email", correo: "email",
  push: "push", notificacion: "push", notificaciones: "push",
};

const PAID_MEDIUM = /^(cpc|ppc|paid|paidsocial|paid[-_ ]social|ads?|display|banner|sponsored|pago|publicidad)$/i;

// host → canal (se compara por dominio, con o sin subdominios: l.instagram.com, m.facebook.com…)
const HOSTS: [RegExp, Channel][] = [
  [/(^|\.)mail\.google\.com$|(^|\.)outlook\.(live|office|office365)\.com$|(^|\.)mail\.yahoo\.com$/, "email"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook|fb|messenger)\.com$|(^|\.)fb\.me$/, "facebook"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)pinterest\.[a-z.]+$/, "pinterest"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(bing\.com|duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|search\.brave\.com)$/, "buscadores"],
];

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

export function classifyTraffic(input: TrafficInput): TrafficSource {
  const params = new URLSearchParams((input.search ?? "").replace(/^\?/, ""));
  const clean = (k: string) => (params.get(k) ?? "").trim().toLowerCase().slice(0, 80);
  const utmSource = clean("utm_source");
  const utmMedium = clean("utm_medium");
  const campaign = (params.get("utm_campaign") ?? "").trim().slice(0, 80) || null;
  const refHost = hostOf(input.referrer);
  const own = (input.siteHost ?? "").toLowerCase().replace(/^www\./, "");
  const external = refHost && refHost !== own && !(own && refHost.endsWith("." + own)) ? refHost : null;
  const ua = input.userAgent ?? "";

  let channel: Channel | null = null;
  let referrerHost: string | null = null;

  if (utmSource) channel = UTM_SOURCES[utmSource] ?? null;
  if (!channel && utmSource) { channel = "otro"; referrerHost = utmSource; }

  if (!channel && external) {
    const hit = HOSTS.find(([re]) => re.test(external));
    if (hit) channel = hit[1];
    else { channel = "sitio"; referrerHost = external; }
  }
  if (!channel) {
    if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) channel = "google";
    else if (/Instagram/i.test(ua)) channel = "instagram";
    else if (/FBAN|FBAV|FB_IAB/i.test(ua)) channel = "facebook";
    else if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) channel = "tiktok";
    else if (params.has("igshid")) channel = "instagram";
    else if (params.has("fbclid")) channel = "facebook";
    else if (params.has("ttclid")) channel = "tiktok";
  }
  if (!channel) channel = "directo";

  // Publicidad: el link trae un medio de pago (utm_medium=cpc, paid…), la fuente dice "ads" o es un clic de Google Ads
  const googleAdsClick = channel === "google" && (params.has("gclid") || params.has("gbraid") || params.has("wbraid"));
  const paid = PAID_MEDIUM.test(utmMedium) || /(^|[-_ ])ads?($|[-_ ])/.test(utmSource) || googleAdsClick;
  return { channel, paid, campaign, referrerHost };
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", tiktok: "TikTok", youtube: "YouTube", x: "X (Twitter)",
  pinterest: "Pinterest", linkedin: "LinkedIn", google: "Google", buscadores: "Otros buscadores", email: "Email",
  push: "Notificaciones", otro: "Otro (UTM)", sitio: "Otros sitios", directo: "Directo",
};

export function sourceLabel(channel: string, paid: boolean): string {
  const base = CHANNEL_LABELS[channel as Channel] ?? channel;
  if (channel === "google") return paid ? "Google (publicidad)" : "Google (búsqueda orgánica)";
  if (paid) return `${base} (publicidad)`;
  if (["instagram", "facebook", "tiktok", "youtube", "x", "pinterest", "linkedin"].includes(channel)) return `${base} (orgánico)`;
  return base;
}
