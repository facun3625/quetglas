import { slugify } from "@/lib/slug";
import type { WooProduct, WooVariation } from "./types";

// Funciones puras de conversión Woo -> modelo propio (testeables sin base ni red).

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Woo devuelve nombres con entidades HTML (&amp;, &#8211;...)
export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type Pricing = { price: number; compareAtPrice: number | null };

export function mapPricing(p: Pick<WooProduct | WooVariation, "regular_price" | "sale_price" | "price" | "on_sale">): Pricing {
  const regular = num(p.regular_price);
  const sale = num(p.sale_price);
  if (regular !== null && sale !== null && sale < regular && p.on_sale !== false) {
    return { price: sale, compareAtPrice: regular };
  }
  return { price: regular ?? num(p.price) ?? 0, compareAtPrice: null };
}

export type StockInfo = { manageStock: boolean; stock: number };

// manage_stock = true: se usa stock_quantity. Si no se maneja, "outofstock" se
// traduce a stock 0 (para que figure agotado) y "instock" a stock sin control.
export function mapStock(p: { manage_stock?: boolean | "parent"; stock_quantity?: number | null; stock_status?: string }): StockInfo {
  if (p.manage_stock === true) return { manageStock: true, stock: Math.max(0, Math.trunc(p.stock_quantity ?? 0)) };
  if (p.stock_status === "outofstock") return { manageStock: true, stock: 0 };
  return { manageStock: false, stock: 0 };
}

export function mapStatus(status: string | undefined): "published" | "draft" {
  return status === "publish" ? "published" : "draft";
}

export function mapShipping(p: Pick<WooProduct, "weight" | "dimensions">) {
  return {
    weight: num(p.weight),
    length: num(p.dimensions?.length),
    width: num(p.dimensions?.width),
    height: num(p.dimensions?.height),
  };
}

export const termSlug = (name: string) => slugify(decodeEntities(name));

export function customerName(c: { first_name?: string; last_name?: string; billing?: { first_name?: string; last_name?: string }; username?: string }): string | null {
  const first = c.first_name || c.billing?.first_name || "";
  const last = c.last_name || c.billing?.last_name || "";
  return `${first} ${last}`.trim() || c.username || null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string | undefined): value is string => Boolean(value && value.length <= 254 && EMAIL.test(value));
