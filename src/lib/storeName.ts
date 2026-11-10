// Nombre de la tienda para todo texto que lo necesite (mails, WhatsApp, cobros, buscadores). Sale de Configuración →
// Franquicia; si todavía no se cargó, un nombre neutro. Sin dependencias de servidor: lo pueden usar también los
// componentes del navegador.
export const DEFAULT_STORE_NAME = "Mi tienda";

export function storeNameOf(row?: { franchiseName?: string | null } | null): string {
  return row?.franchiseName?.trim() || DEFAULT_STORE_NAME;
}
