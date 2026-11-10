import { normalizeVideoUrl } from "@/lib/video";
// Temas visuales de campaña. Todo lo que guarda el admin pasa por sanitizeThemeConfig: colores solo en hexadecimal,
// tipografías de una lista cerrada, URLs http(s) o relativas, textos con largo máximo. El CSS que se inyecta en el
// sitio se arma ÚNICAMENTE con esos valores ya validados, así que un tema no puede meter código en las páginas.

export type FontKey = "default" | "playfair" | "montserrat" | "lora" | "bebas" | "pacifico" | "oswald" | "merriweather" | "raleway";

export const FONT_CHOICES: Record<FontKey, { label: string; family: string | null; google: string | null }> = {
  default: { label: "La de siempre (Poppins)", family: null, google: null },
  playfair: { label: "Playfair Display (elegante)", family: "'Playfair Display', serif", google: "Playfair+Display:wght@600;700;800" },
  montserrat: { label: "Montserrat (moderna)", family: "'Montserrat', sans-serif", google: "Montserrat:wght@600;700;800" },
  lora: { label: "Lora (clásica)", family: "'Lora', serif", google: "Lora:wght@600;700" },
  bebas: { label: "Bebas Neue (impacto)", family: "'Bebas Neue', sans-serif", google: "Bebas+Neue" },
  pacifico: { label: "Pacifico (manuscrita)", family: "'Pacifico', cursive", google: "Pacifico" },
  oswald: { label: "Oswald (condensada)", family: "'Oswald', sans-serif", google: "Oswald:wght@500;600;700" },
  merriweather: { label: "Merriweather (editorial)", family: "'Merriweather', serif", google: "Merriweather:wght@700;900" },
  raleway: { label: "Raleway (liviana)", family: "'Raleway', sans-serif", google: "Raleway:wght@600;700;800" },
};

export type ButtonStyle = "pill" | "rounded" | "square";

export type ThemeSlide = { image: string; videoUrl: string; eyebrow: string; title: string; subtitle: string; promoText: string; buttons: { label: string; href: string }[] };

export type ThemeConfig = {
  colors: { primary: string; primaryDark: string; ink: string; muted: string; soft: string; background: string };
  headingFont: FontKey;
  buttonStyle: ButtonStyle;
  backgroundImageUrl: string;
  announcement: { enabled: boolean; text: string; href: string; bg: string; color: string };
  hero: ThemeSlide[];
  // Tarjetas destacadas del inicio (arriba de "Explorá por categoría"), con un título de sección opcional
  bannersTitle: string;
  banners: { image: string; title: string; href: string; alt: string }[];
  // Portadas de categoría propias de esta campaña (categoryId -> url). Sin entrada para una categoría, se usa
  // la del aspecto base (Category.imageUrl). No aplica al aspecto base en sí, que usa Category.imageUrl directo.
  categoryImages: Record<string, string>;
};

// Los colores de la tienda tal cual están hoy (el "tema base")
export const BASE_COLORS: ThemeConfig["colors"] = {
  primary: "#e52327",
  primaryDark: "#c4161a",
  ink: "#383e45",
  muted: "#685563",
  soft: "#f6f6f6",
  background: "#ffffff",
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  colors: BASE_COLORS,
  headingFont: "default",
  buttonStyle: "pill",
  backgroundImageUrl: "",
  announcement: { enabled: false, text: "", href: "", bg: "#c4161a", color: "#ffffff" },
  hero: [],
  bannersTitle: "",
  banners: [],
  categoryImages: {},
};

const HEX = /^#[0-9a-fA-F]{6}$/;
// Solo caracteres seguros: sin comillas, paréntesis, espacios ni barras invertidas (se usa dentro de url("..."))
export const MAX_SLIDES = 5;
export const MAX_BANNERS = 6;

const SAFE_URL = /^(https?:\/\/[A-Za-z0-9\-._~:/?#@!$&*+,;=%\[\]]+|\/(?!\/)[A-Za-z0-9\-._~:/?#@!$&*+,;=%\[\]]*)$/;

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");
const hex = (v: unknown, fallback: string): string => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);
const url = (v: unknown): string => {
  const s = str(v, 500);
  return s && SAFE_URL.test(s) ? s : "";
};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asObj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function sanitizeThemeConfig(input: unknown): ThemeConfig {
  const c = asObj(input);
  const colors = asObj(c.colors);
  const ann = asObj(c.announcement);
  const font = typeof c.headingFont === "string" && c.headingFont in FONT_CHOICES ? (c.headingFont as FontKey) : "default";
  const button = c.buttonStyle === "rounded" || c.buttonStyle === "square" ? c.buttonStyle : "pill";

  return {
    colors: {
      primary: hex(colors.primary, BASE_COLORS.primary),
      primaryDark: hex(colors.primaryDark, BASE_COLORS.primaryDark),
      ink: hex(colors.ink, BASE_COLORS.ink),
      muted: hex(colors.muted, BASE_COLORS.muted),
      soft: hex(colors.soft, BASE_COLORS.soft),
      background: hex(colors.background, BASE_COLORS.background),
    },
    headingFont: font,
    buttonStyle: button,
    backgroundImageUrl: url(c.backgroundImageUrl),
    announcement: {
      enabled: ann.enabled === true,
      text: str(ann.text, 160),
      href: url(ann.href),
      bg: hex(ann.bg, DEFAULT_THEME_CONFIG.announcement.bg),
      color: hex(ann.color, DEFAULT_THEME_CONFIG.announcement.color),
    },
    hero: asArray(c.hero)
      .map((raw) => {
        const s = asObj(raw);
        return {
          image: url(s.image),
          videoUrl: normalizeVideoUrl(str(s.videoUrl, 600)),
          eyebrow: str(s.eyebrow, 60),
          title: str(s.title, 80),
          subtitle: str(s.subtitle, 200),
          promoText: str(s.promoText, 60),
          buttons: asArray(s.buttons)
            .map((b) => ({ label: str(asObj(b).label, 30), href: url(asObj(b).href) }))
            .filter((b) => b.label && b.href)
            .slice(0, 3),
        };
      })
      // Cada slide necesita título y una imagen o un video (la imagen es también la portada del video)
      .filter((s) => (s.image || s.videoUrl) && s.title)
      .slice(0, MAX_SLIDES),
    bannersTitle: str(c.bannersTitle, 80),
    banners: asArray(c.banners)
      .map((raw) => ({ image: url(asObj(raw).image), title: str(asObj(raw).title, 60), href: url(asObj(raw).href), alt: str(asObj(raw).alt, 120) }))
      .filter((b) => b.image)
      .slice(0, MAX_BANNERS),
    categoryImages: Object.fromEntries(
      Object.entries(asObj(c.categoryImages))
        .filter(([id]) => /^[A-Za-z0-9_-]{1,40}$/.test(id))
        .map(([id, v]) => [id, url(v)])
        .filter(([, v]) => v)
        .slice(0, 200)
    ),
  };
}

// Variables y reglas CSS del tema (solo valores ya validados)
export function themeCss(config: ThemeConfig): string {
  const { colors } = config;
  const rules: string[] = [
    `:root{--background:${colors.background};--foreground:${colors.ink};--color-brand-pink:${colors.primary};--color-brand-pink-dark:${colors.primaryDark};--color-brand-ink:${colors.ink};--color-brand-muted:${colors.muted};--color-brand-soft:${colors.soft};}`,
  ];
  const font = FONT_CHOICES[config.headingFont];
  if (font.family) rules.push(`h1,h2,h3,.font-heading{font-family:${font.family},var(--font-poppins),system-ui,sans-serif}`);
  if (config.buttonStyle === "rounded") rules.push(`:is(a,button).rounded-full:where(.bg-brand-pink,.border-brand-pink){border-radius:.5rem}`);
  if (config.buttonStyle === "square") rules.push(`:is(a,button).rounded-full:where(.bg-brand-pink,.border-brand-pink){border-radius:0}`);
  if (config.backgroundImageUrl) rules.push(`body{background-image:url("${config.backgroundImageUrl}");background-size:cover;background-attachment:fixed;background-position:center}`);
  return rules.join("\n");
}

export function themeFontHref(config: ThemeConfig): string | null {
  const google = FONT_CHOICES[config.headingFont].google;
  return google ? `https://fonts.googleapis.com/css2?family=${google}&display=swap` : null;
}

export type ThemeWindow = { id: string; enabled: boolean; startsAt: Date | null; endsAt: Date | null; updatedAt: Date };

export function isThemeLive(t: Pick<ThemeWindow, "enabled" | "startsAt" | "endsAt">, now = new Date()): boolean {
  return t.enabled && (!t.startsAt || t.startsAt <= now) && (!t.endsAt || t.endsAt >= now);
}

// De los temas vigentes ahora, gana el que empezó más recientemente (y, a igual inicio, el editado último)
export function pickActiveTheme<T extends ThemeWindow>(themes: T[], now = new Date()): T | null {
  const live = themes.filter((t) => isThemeLive(t, now));
  if (live.length === 0) return null;
  return live.sort((a, b) => (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0) || b.updatedAt.getTime() - a.updatedAt.getTime())[0];
}

export type ThemeStatus = "live" | "scheduled" | "expired" | "inactive" | "overridden";

export function themeStatus(t: ThemeWindow, activeId: string | null, now = new Date()): ThemeStatus {
  if (!t.enabled) return "inactive";
  if (t.endsAt && t.endsAt < now) return "expired";
  if (t.startsAt && t.startsAt > now) return "scheduled";
  return t.id === activeId ? "live" : "overridden";
}

// Plantillas de arranque para las campañas más comunes (el admin las ajusta a su gusto)
export const THEME_TEMPLATES: { key: string; name: string; description: string; config: Partial<ThemeConfig> }[] = [
  {
    key: "navidad", name: "Navidad", description: "Rojo y verde, con barra de anuncio.",
    config: { colors: { primary: "#c0392b", primaryDark: "#922b21", ink: "#1e3a2f", muted: "#5b6b62", soft: "#f6efe6", background: "#ffffff" }, headingFont: "playfair", buttonStyle: "rounded", announcement: { enabled: true, text: "🎄 Ofertas de Navidad: envíos en todo el país", href: "/tienda?ofertas=1", bg: "#1e6b43", color: "#ffffff" } },
  },
  {
    key: "black-friday", name: "Black Friday", description: "Negro y amarillo de alto contraste.",
    config: { colors: { primary: "#f5b700", primaryDark: "#c58f00", ink: "#111111", muted: "#555555", soft: "#f2f2f2", background: "#ffffff" }, headingFont: "bebas", buttonStyle: "square", announcement: { enabled: true, text: "BLACK FRIDAY — hasta 40% off en toda la tienda", href: "/tienda?ofertas=1", bg: "#111111", color: "#f5b700" } },
  },
  {
    key: "hot-sale", name: "Hot Sale", description: "Naranja intenso para liquidaciones.",
    config: { colors: { primary: "#ff6b1a", primaryDark: "#d94e00", ink: "#2b2b2b", muted: "#6b5d55", soft: "#fff4ec", background: "#ffffff" }, headingFont: "oswald", announcement: { enabled: true, text: "🔥 Hot Sale: cuotas y descuentos por tiempo limitado", href: "/tienda?ofertas=1", bg: "#d94e00", color: "#ffffff" } },
  },
  {
    key: "dia-de-la-madre", name: "Día de la Madre", description: "Rosa suave y tipografía elegante.",
    config: { colors: { primary: "#e86a92", primaryDark: "#c2185b", ink: "#4a3040", muted: "#7a5a6b", soft: "#fdf1f5", background: "#ffffff" }, headingFont: "playfair", announcement: { enabled: true, text: "💐 Día de la Madre: regalos para sorprender", href: "/tienda", bg: "#c2185b", color: "#ffffff" } },
  },
  {
    key: "dia-del-padre", name: "Día del Padre", description: "Azules sobrios.",
    config: { colors: { primary: "#2f6fb3", primaryDark: "#1d4e85", ink: "#1f2a37", muted: "#556270", soft: "#eef3f9", background: "#ffffff" }, headingFont: "montserrat", buttonStyle: "rounded", announcement: { enabled: true, text: "👔 Día del Padre: encontrá el regalo ideal", href: "/tienda", bg: "#1d4e85", color: "#ffffff" } },
  },
  {
    key: "halloween", name: "Halloween", description: "Naranja y violeta oscuro.",
    config: { colors: { primary: "#ff7a1a", primaryDark: "#c75600", ink: "#24133a", muted: "#5d4a73", soft: "#f4eefb", background: "#ffffff" }, headingFont: "pacifico", announcement: { enabled: true, text: "🎃 Semana de Halloween: sorpresas y descuentos", href: "/tienda?ofertas=1", bg: "#24133a", color: "#ff7a1a" } },
  },
  {
    key: "lanzamiento", name: "Lanzamiento", description: "Colores de estreno sobre la base de la tienda.",
    config: { colors: { ...BASE_COLORS, primary: "#6c4de6", primaryDark: "#4b2fc0" }, headingFont: "raleway", announcement: { enabled: true, text: "✨ Nueva colección ya disponible", href: "/tienda", bg: "#4b2fc0", color: "#ffffff" } },
  },
];

export function configFromTemplate(key: string): ThemeConfig {
  const t = THEME_TEMPLATES.find((x) => x.key === key);
  return sanitizeThemeConfig({ ...DEFAULT_THEME_CONFIG, ...(t?.config ?? {}) });
}
