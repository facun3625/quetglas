// Enlaces de las tarjetas de contacto (sin base de datos: se usa también desde componentes del navegador)
const digits = (v: string) => v.replace(/\D/g, "");

export const phoneHref = (phone: string) => `tel:+${digits(phone)}`;
export const whatsappHref = (number: string) => `https://wa.me/${digits(number)}`;
// Acepta "@usuario", "usuario" o la URL completa del perfil
export function instagramHandle(value: string): string {
  return value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
}
