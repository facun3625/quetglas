// Existencia de un producto o variante en tres estados simples, sobre los mismos datos de siempre (manageStock + stock):
//  - available ("Hay existencia"): sin control de cantidad; siempre se puede comprar. manageStock = false.
//  - unavailable ("No hay existencia"): no se puede comprar; en la tienda figura "Sin stock" con el aviso de reposición.
//    manageStock = true y stock = 0.
//  - tracked ("Controlar cantidad"): se lleva la cuenta de unidades; cada venta descuenta. manageStock = true.
// No hay datos nuevos: lo que ya estaba cargado (por ejemplo lo que se migró) ya cae en alguno de estos tres.
// Módulo sin dependencias de servidor: lo usan el formulario, el listado y las acciones masivas.

export type StockMode = "available" | "unavailable" | "tracked";

export const STOCK_MODE_LABEL: Record<StockMode, string> = {
  available: "Hay existencia",
  unavailable: "No hay existencia",
  tracked: "Controlar cantidad",
};

export function stockModeOf(p: { manageStock: boolean; stock: number }): StockMode {
  if (!p.manageStock) return "available";
  return p.stock > 0 ? "tracked" : "unavailable";
}

// Datos que se guardan para cada estado. Para "tracked" se usa la cantidad indicada (nunca negativa).
export function stockFieldsFor(mode: StockMode, quantity = 0): { manageStock: boolean; stock: number } {
  if (mode === "available") return { manageStock: false, stock: 0 };
  if (mode === "unavailable") return { manageStock: true, stock: 0 };
  return { manageStock: true, stock: Math.max(0, Math.trunc(Number.isFinite(quantity) ? quantity : 0)) };
}
