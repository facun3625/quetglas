// wa.me solo acepta el número en dígitos (con código de país, sin +, espacios
// ni guiones) — el teléfono viene de texto libre (checkout, lista de espera),
// así que hay que limpiarlo antes de armar el link.
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

// No valida que el número tenga WhatsApp (eso solo lo sabe WhatsApp al
// abrir el chat) — solo filtra que tenga pinta de teléfono real (cantidad
// de dígitos de un número con código de país), para no mostrar el botón
// con cosas tipo "asdf" cargadas por error.
export function isLikelyPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
