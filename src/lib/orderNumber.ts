// Número de pedido visible: #0001, #0002... (el id interno es un código largo)
export function formatOrderNumber(number: number): string {
  return `#${String(number).padStart(4, "0")}`;
}

// Acepta "#12", "12" o "0012" y devuelve el número, o null si no parece uno
export function parseOrderNumber(text: string): number | null {
  const match = /^#?\s*0*(\d{1,9})$/.exec(text.trim());
  return match ? Number(match[1]) : null;
}
