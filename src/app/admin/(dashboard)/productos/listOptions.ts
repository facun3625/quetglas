// Opciones del listado de productos. En un módulo común (no en ListControls.tsx, que es un componente de cliente) para
// que las pueda usar tanto la página (servidor) como los selectores (navegador).
export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 100;

// Opciones de orden: "campo:dirección". Nombre A → Z es el orden de siempre.
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "name:asc", label: "Nombre (A → Z)" },
  { value: "name:desc", label: "Nombre (Z → A)" },
  { value: "price:asc", label: "Precio (menor a mayor)" },
  { value: "price:desc", label: "Precio (mayor a menor)" },
  { value: "stock:asc", label: "Stock (menor a mayor)" },
  { value: "stock:desc", label: "Stock (mayor a menor)" },
  { value: "category:asc", label: "Categoría (A → Z)" },
  { value: "category:desc", label: "Categoría (Z → A)" },
];
