// Forma "liviana" de un producto para listados, buscador, carrito y favoritos.
// Se arma en lib/products.ts a partir de la base propia.
export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  type: "simple" | "variable";
  // Para productos variables es el precio "desde" (mínimo entre variantes).
  price: number;
  compareAtPrice: number | null;
  // Para productos variables es la suma del stock de las variantes habilitadas.
  stock: number;
  // true si hoy tiene un descuento visible (precio tachado o promoción vigente)
  onSale: boolean;
  image: string | null;
  thumb: string | null;
  // true si la primera foto de la galería es un video (la portada muestra un ícono de play)
  hasVideo: boolean;
  categoryId: string | null;
  categoryName: string | null;
};

export type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl: string | null;
  // Cartel de "todavía no tiene productos" — ver Category.comingSoonMessage en el schema.
  comingSoonMessage: string | null;
};
