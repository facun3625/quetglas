import type { CategoryItem } from "@/types/catalog";

// Funciones puras (sin tocar Prisma) separadas de lib/categories.ts a
// propósito: éste es el único archivo del que puede importar un client
// component como CategorySidebar. lib/categories.ts importa Prisma, que
// rompe el bundle del browser si se importa desde uno.
export function topLevelCategories(categories: CategoryItem[]): CategoryItem[] {
  return categories.filter((c) => c.parentId === null);
}

export function childrenOf(categories: CategoryItem[], parentId: string): CategoryItem[] {
  return categories.filter((c) => c.parentId === parentId);
}

// Ids de una categoría y de todas sus descendientes (árbol de profundidad ilimitada).
export function descendantIds(categories: CategoryItem[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const c of categories) if (c.parentId === ids[i] && !ids.includes(c.id)) ids.push(c.id);
  }
  return ids;
}
