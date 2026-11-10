// Orden alfabético "de verdad" para nombres de productos: sin distinguir mayúsculas ni tildes ("abeja" antes que "Zeta",
// "ÁRBOL" junto a "arbol", "Ñandú" después de "Nube") y con números naturales ("Pico 2" antes que "Pico 10").
// Se hace acá y no en la base porque Postgres sobre Alpine (el de la guía de instalación) ordena por bytes: las
// mayúsculas van antes que las minúsculas y las letras con tilde quedan al final.
const base = new Intl.Collator("es-AR", { sensitivity: "base", numeric: true });
const variant = new Intl.Collator("es-AR", { sensitivity: "variant", numeric: true });

export function compareNames(a: string, b: string): number {
  return base.compare(a, b) || variant.compare(a, b);
}

// Orden estable: si dos productos se llaman igual, desempata por id para que la paginación no repita ni saltee
export function compareByName<T extends { name: string; id: string }>(a: T, b: T): number {
  return compareNames(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
