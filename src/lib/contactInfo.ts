import { instagramHandle } from "@/lib/contactLinks";

// Datos de contacto de la tienda: lo que se cargó a mano en Configuración → General y, si falta, lo de la primera tarjeta de
// "Contacto" que lo tenga. No hay valores de fábrica: sin datos cargados, queda vacío y el sitio simplemente no lo muestra.
type CardLike = { address: string | null; whatsapp: string | null; instagram: string | null };
type RowLike = { whatsappPhone?: string | null; instagramHandle?: string | null; address?: string | null; contactEmail?: string | null };

export function resolveContact(row: RowLike, cards: CardLike[], franchiseLocation: string) {
  const firstOf = (key: keyof CardLike) => cards.map((c) => c[key]?.trim() ?? "").find(Boolean) ?? "";
  const street = firstOf("address");
  const insta = firstOf("instagram");
  return {
    whatsappNumber: row.whatsappPhone?.trim() || firstOf("whatsapp"),
    instagramHandle: row.instagramHandle?.trim() || (insta ? instagramHandle(insta) : ""),
    // "Calle 123 — Ciudad": la calle sale de la primera tarjeta con dirección
    address: row.address?.trim() || (street ? `${street}${franchiseLocation ? ` — ${franchiseLocation}` : ""}` : ""),
    contactEmail: row.contactEmail?.trim() || "",
  };
}
