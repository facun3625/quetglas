// URL pública del sitio (sin barra final) para sitemap, canonicals y datos estructurados
export function siteUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
