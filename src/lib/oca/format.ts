// Normalizaciones que pide OCA ePak (puras, sin red). Portadas tal cual del flujo que ya funciona en Araí.

export function escapeXml(value: string): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// OCA espera el CUIT como XX-XXXXXXXX-X
export function formatCuit(raw: string | null | undefined): string | null {
  const digits = raw?.replace(/-/g, "").trim();
  if (!digits) return null;
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : digits;
}

// "3B" -> piso 3, depto B ; "4" -> piso 4 ; "PB A" -> depto A
export function parseApartment(apartment: string | null | undefined): { piso: string; depto: string } {
  const trimmed = apartment?.trim() ?? "";
  const num = trimmed.match(/^(\d+)/);
  const alpha = trimmed.match(/[a-zA-Z]+$/);
  return { piso: num ? num[1] : "", depto: alpha ? alpha[0].toUpperCase() : "" };
}

export function sanitizeEmail(email: string | null | undefined): string {
  const trimmed = email?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

const CABA_VARIANTS = ["caba", "capital federal", "ciudad autónoma de buenos aires", "ciudad autonoma de buenos aires"];

export function normalizeProvince(province: string | null | undefined): string {
  const t = province?.trim() ?? "";
  return CABA_VARIANTS.includes(t.toLowerCase()) ? "CAPITAL FEDERAL" : removeAccents(t.toUpperCase());
}

export function normalizeCity(city: string | null | undefined, normalizedProvince: string): string {
  if (normalizedProvince === "CAPITAL FEDERAL") return "CAPITAL FEDERAL";
  return removeAccents((city?.trim() ?? "").toUpperCase());
}

// "2026-10-01T..." -> "20261001"
export const ocaDate = (date = new Date()) => date.toISOString().slice(0, 10).replace(/-/g, "");
