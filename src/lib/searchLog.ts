import { prisma } from "@/lib/prisma";

// Registra una búsqueda hecha en la tienda. Nunca debe romper ni demorar la página: se llama sin esperar.
export function logSearch(term: string, resultsCount: number): void {
  const clean = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (clean.length < 2) return;
  prisma.searchQuery.create({ data: { term: clean, resultsCount } }).catch((err) => console.error("logSearch failed", err));
}
