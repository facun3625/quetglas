// Peso y medidas de lo que se envía. Dos usos, igual que en Araí:
//  - cotizar: peso total y volumen total (m³), sumando cada artículo por su cantidad;
//  - registrar el retiro: un solo bulto con el peso total redondeado hacia arriba (mínimo 1 kg) y, como OCA
//    no permite armar varios bultos acá, las medidas del artículo MÁS GRANDE (estimación conservadora).

export type ShippingItem = {
  quantity: number;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
};

export type PackageDefaults = { weightKg: number; dimCm: number };

export const FALLBACK_DEFAULTS: PackageDefaults = { weightKg: 1, dimCm: 20 };

const positive = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);

// Para la cotización: kg totales y m³ totales
export function quoteMeasures(items: ShippingItem[], defaults: PackageDefaults = FALLBACK_DEFAULTS) {
  let weightKg = 0;
  let volumeM3 = 0;
  for (const item of items) {
    const w = positive(item.weight) ?? defaults.weightKg;
    const volume = ((positive(item.width) ?? defaults.dimCm) * (positive(item.height) ?? defaults.dimCm) * (positive(item.length) ?? defaults.dimCm)) / 1_000_000;
    weightKg += w * item.quantity;
    volumeM3 += volume * item.quantity;
  }
  // Se redondea para no mandar decimales larguísimos en la URL (no cambia la tarifa de OCA)
  return { weightKg: Math.round(weightKg * 1000) / 1000, volumeM3: Math.round(volumeM3 * 1_000_000) / 1_000_000 };
}

// Para registrar el retiro: un bulto
export function shipmentPackage(items: ShippingItem[], defaults: PackageDefaults = FALLBACK_DEFAULTS) {
  const totalKg = items.reduce((sum, i) => sum + (positive(i.weight) ?? defaults.weightKg) * i.quantity, 0);
  const maxDim = (key: "width" | "height" | "length") => items.reduce((max, i) => Math.max(max, positive(i[key]) ?? 0), 0) || defaults.dimCm;
  return {
    pesoKg: Math.max(1, Math.ceil(totalKg)),
    altoCm: Math.ceil(maxDim("height")),
    anchoCm: Math.ceil(maxDim("width")),
    largoCm: Math.ceil(maxDim("length")),
    // Avisa en el panel si algún artículo no tenía peso o medidas cargadas y se usó el valor por defecto
    usedDefaults: items.some((i) => positive(i.weight) === null || positive(i.width) === null || positive(i.height) === null || positive(i.length) === null),
  };
}
