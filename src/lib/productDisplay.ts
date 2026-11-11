// Opciones de cómo se muestran los precios en la tienda (Configuración → Productos):
// - Etiqueta de descuento ("-40% OFF"), calculada con el precio anterior del producto.
// - Leyendas de precio: cuotas ("3 x $17.365,67 sin interés", la cuenta se hace sola) o texto libre ("Envío gratis"),
//   cada una con un logo opcional, un precio mínimo y dónde se ve (tarjetas, página del producto o las dos).
// Todo lo que se guarda pasa por sanitizeProductDisplay: textos cortos, colores hex, URLs de imágenes del propio panel.

export type PriceNotePlace = "both" | "card" | "product";
export type PriceNote = {
  enabled: boolean;
  installments: number; // 0 = texto libre; 2..24 = cuotas
  text: string; // cuotas: lo que va después del monto ("sin interés", "con"); texto libre: la leyenda
  logoUrl: string;
  minPrice: number; // 0 = sin mínimo
  place: PriceNotePlace;
};
export type ProductDisplay = {
  discountBadge: { enabled: boolean; text: string; bg: string; color: string };
  notes: PriceNote[];
};

export const MAX_PRICE_NOTES = 6;

export const DEFAULT_PRODUCT_DISPLAY: ProductDisplay = {
  discountBadge: { enabled: false, text: "-{pct}% OFF", bg: "#e52327", color: "#ffffff" },
  notes: [],
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max) : "");
const hex = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const img = (v: unknown) => {
  const s = str(v, 500);
  return /^(https:\/\/[^\s"'()<>\\]+|\/api\/uploads\/[^\s"'()<>\\]+|\/[A-Za-z0-9._\-/]+)$/.test(s) ? s : "";
};

export function sanitizeProductDisplay(input: unknown): ProductDisplay {
  const c = obj(input);
  const b = obj(c.discountBadge);
  const d = DEFAULT_PRODUCT_DISPLAY.discountBadge;
  return {
    discountBadge: {
      enabled: b.enabled === true,
      text: str(b.text, 30) || d.text,
      bg: hex(b.bg, d.bg),
      color: hex(b.color, d.color),
    },
    notes: (Array.isArray(c.notes) ? c.notes : [])
      .map((raw) => {
        const n = obj(raw);
        const installments = Math.round(Number(n.installments) || 0);
        const place = n.place === "card" || n.place === "product" ? n.place : "both";
        return {
          enabled: n.enabled !== false,
          installments: installments >= 2 && installments <= 24 ? installments : 0,
          text: str(n.text, 60),
          logoUrl: img(n.logoUrl),
          minPrice: Math.max(0, Math.round(Number(n.minPrice) || 0)),
          place,
        } satisfies PriceNote;
      })
      // Una leyenda de texto libre sin texto ni logo no muestra nada
      .filter((n) => n.installments > 0 || n.text || n.logoUrl)
      .slice(0, MAX_PRICE_NOTES),
  };
}

export function discountPct(price: number, compareAtPrice: number | null): number {
  if (!compareAtPrice || compareAtPrice <= price || compareAtPrice <= 0) return 0;
  return Math.round((1 - price / compareAtPrice) * 100);
}

// Leyendas que corresponden a ese precio y ese lugar
export function notesFor(display: ProductDisplay, price: number, where: "card" | "product"): PriceNote[] {
  return display.notes.filter((n) => n.enabled && (n.place === "both" || n.place === where) && price >= n.minPrice && price > 0);
}
