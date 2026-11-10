// Formato de precios de toda la tienda — módulo puro (sin "use client") para poder
// usarlo tanto en componentes de servidor como de cliente. Una sola moneda para
// todo el catálogo (se elige en /admin/configuracion), sin conversión.
export type CurrencyCode = "ARS" | "USD";

export function formatMoneyWith(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-AR", {
    style: "currency",
    currency,
    currencyDisplay: currency === "USD" ? "code" : "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/\s/g, " ");
}
