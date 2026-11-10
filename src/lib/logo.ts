// Logos de la tienda: los que subió el admin (Configuración → General → Logo e íconos) o el original de la instalación.
export const DEFAULT_LOGO = "/logo2.png";

type LogoRow = { logoHeaderUrl?: string | null; logoFooterUrl?: string | null; faviconUrl?: string | null };

export function resolveLogos(row: LogoRow) {
  const header = row.logoHeaderUrl?.trim() || DEFAULT_LOGO;
  return {
    header,
    // El del pie, si no se cargó, es el mismo del encabezado
    footer: row.logoFooterUrl?.trim() || header,
    favicon: row.faviconUrl?.trim() || null,
  };
}

// URL absoluta para los mails (los clientes de correo no entienden rutas relativas)
export function absoluteUrl(url: string, base = process.env.NEXTAUTH_URL ?? ""): string {
  return /^https?:\/\//i.test(url) ? url : `${base.replace(/\/$/, "")}${url}`;
}
