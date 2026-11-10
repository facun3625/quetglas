import { slugify } from "@/lib/slug";

// Importación de productos desde Excel — parte "pura": de las filas de la planilla a un plan validado.
// No toca la base: lo que hace falta de la base (qué SKU ya existen) entra como `Existing`.
// Formato: ver public/descargas/plantilla-productos.xlsx (una fila por producto simple o por variante;
// filas con el mismo `grupo` forman un producto con variantes; columnas `atributo:<Nombre>` opcionales).

export type Issue = { level: "error" | "warning"; row: number | null; sku?: string; message: string };

export type ImageRef = { kind: "url"; url: string } | { kind: "zip"; name: string };

// Campos comunes. `undefined` = la celda vino vacía: al actualizar no se toca ese dato.
type Common = {
  price?: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock?: number;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  images?: ImageRef[];
};

type ProductFields = {
  name?: string;
  categories?: string[][]; // cada una es una ruta: ["Dermocosmética", "Protección solar"]
  status?: "published" | "draft";
  featured?: boolean;
  shortDescription?: string;
  description?: string;
  tags?: string[];
};

export type PlannedVariant = Common & { row: number; sku: string; terms: { attribute: string; value: string }[] };

export type PlannedProduct =
  | (Common & ProductFields & { kind: "simple"; row: number; sku: string })
  | (ProductFields & { kind: "variable"; row: number; sku: string; attributes: string[]; variants: PlannedVariant[] })
  // Fila sin grupo cuyo SKU es de una variante ya cargada: actualiza solo esa variante (precio, stock, foto…)
  | (Common & ProductFields & { kind: "variantUpdate"; row: number; sku: string });

export type Plan = { products: PlannedProduct[]; issues: Issue[] };

export type SheetData = { headers: string[]; rows: { row: number; cells: string[] }[] };

// ---------- Lectura del .xlsx ----------

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as { richText?: { text: string }[]; text?: unknown; hyperlink?: string; result?: unknown; error?: string };
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (v.hyperlink && typeof v.text !== "object") return String(v.text ?? v.hyperlink);
    if ("result" in v) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
  }
  return "";
}

// Toma la primera hoja (o la llamada "Productos" si existe). La fila 1 son los encabezados.
export async function readSheet(buffer: Buffer | ArrayBuffer): Promise<SheetData> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.getWorksheet("Productos") ?? wb.worksheets[0];
  if (!ws) throw new Error("El archivo no tiene hojas");
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => (headers[col - 1] = cellText(cell.value).trim()));
  const rows: SheetData["rows"] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const cells = headers.map((_, i) => cellText(r.getCell(i + 1).value).trim());
    if (cells.some((c) => c !== "")) rows.push({ row: n, cells });
  });
  return { headers, rows };
}

// ---------- Valores ----------

// "15990", "15.990", "15.990,50", "15990.5", "$ 15.990" → número. null si no se entiende.
export function parseNumber(raw: string): number | null {
  let s = raw.replace(/[$\s]/g, "").replace(/^ars|^usd/i, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el decimal
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // 15.990 → miles
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const YES = new Set(["si", "sí", "s", "yes", "y", "1", "x", "true", "verdadero"]);
const NO = new Set(["no", "n", "0", "false", "falso"]);

export const splitList = (raw: string) => raw.split("|").map((s) => s.trim()).filter(Boolean);

export function parseImageRefs(raw: string): ImageRef[] {
  return splitList(raw).map((s) => (/^https?:\/\//i.test(s) ? { kind: "url", url: s } : { kind: "zip", name: s.split(/[\\/]/).pop()! }));
}

export const imageKey = (ref: ImageRef) => (ref.kind === "url" ? ref.url : `zip:${ref.name.toLowerCase()}`);

// Texto plano de la planilla → HTML simple (párrafos y saltos de línea). Si ya viene con etiquetas HTML se respeta.
export function textToHtml(text: string): string {
  if (/<\/?[a-z][^>]*>/i.test(text)) return text;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// ---------- Encabezados ----------

const COLUMN_ALIASES: Record<string, string> = {
  grupo: "grupo",
  sku: "sku",
  codigo: "sku",
  nombre: "nombre",
  categorias: "categorias",
  categoria: "categorias",
  precio: "precio",
  precio_anterior: "precio_anterior",
  precio_tachado: "precio_anterior",
  costo: "costo",
  precio_costo: "costo",
  stock: "stock",
  estado: "estado",
  destacado: "destacado",
  descripcion_corta: "descripcion_corta",
  descripcion: "descripcion",
  etiquetas: "etiquetas",
  peso_kg: "peso_kg",
  peso: "peso_kg",
  ancho_cm: "ancho_cm",
  ancho: "ancho_cm",
  alto_cm: "alto_cm",
  alto: "alto_cm",
  largo_cm: "largo_cm",
  largo: "largo_cm",
  imagenes: "imagenes",
  imagen: "imagenes",
  fotos: "imagenes",
};

const normHeader = (h: string) =>
  h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[\s-]+/g, "_");

type Columns = { fields: Map<string, number>; attributes: { name: string; index: number }[]; ignored: string[] };

export function mapColumns(headers: string[]): Columns {
  const fields = new Map<string, number>();
  const attributes: Columns["attributes"] = [];
  const ignored: string[] = [];
  headers.forEach((raw, index) => {
    if (!raw) return;
    const attr = raw.match(/^\s*atributo\s*[:\-]\s*(.+)$/i);
    if (attr) {
      const name = attr[1].trim();
      if (!attributes.some((a) => slugify(a.name) === slugify(name))) attributes.push({ name, index });
      return;
    }
    const key = COLUMN_ALIASES[normHeader(raw)];
    if (key && !fields.has(key)) fields.set(key, index);
    else ignored.push(raw);
  });
  return { fields, attributes, ignored };
}

// ---------- Plan ----------

type RowData = { row: number; get: (key: string) => string; terms: { attribute: string; value: string }[] };

export function buildPlan(sheet: SheetData): Plan {
  const issues: Issue[] = [];
  const cols = mapColumns(sheet.headers);
  if (!cols.fields.has("sku")) {
    return { products: [], issues: [{ level: "error", row: 1, message: "Falta la columna obligatoria \"sku\" en la fila de encabezados." }] };
  }
  if (cols.ignored.length) issues.push({ level: "warning", row: 1, message: `Columnas que no se reconocen y se ignoran: ${cols.ignored.join(", ")}` });

  const rows: RowData[] = sheet.rows.map(({ row, cells }) => ({
    row,
    get: (key) => {
      const i = cols.fields.get(key);
      return i === undefined ? "" : (cells[i] ?? "").trim();
    },
    terms: cols.attributes.map((a) => ({ attribute: a.name, value: (cells[a.index] ?? "").trim() })).filter((t) => t.value),
  }));

  // Lectores con validación: anotan el error y devuelven undefined
  let rowFailed = false;
  const err = (row: number, sku: string, message: string) => {
    issues.push({ level: "error", row, sku: sku || undefined, message });
    rowFailed = true;
  };
  const num = (r: RowData, key: string, label: string, sku: string, opts: { int?: boolean } = {}): number | undefined => {
    const raw = r.get(key);
    if (!raw) return undefined;
    const n = parseNumber(raw);
    if (n === null || n < 0 || (opts.int && !Number.isInteger(n))) {
      err(r.row, sku, `${label} inválido: "${raw}"`);
      return undefined;
    }
    return n;
  };
  const common = (r: RowData, sku: string): Common => {
    const c: Common = {
      price: num(r, "precio", "Precio", sku),
      compareAtPrice: num(r, "precio_anterior", "Precio anterior", sku),
      costPrice: num(r, "costo", "Costo", sku),
      stock: num(r, "stock", "Stock", sku, { int: true }),
      weight: num(r, "peso_kg", "Peso", sku),
      width: num(r, "ancho_cm", "Ancho", sku),
      height: num(r, "alto_cm", "Alto", sku),
      length: num(r, "largo_cm", "Largo", sku),
      images: r.get("imagenes") ? parseImageRefs(r.get("imagenes")) : undefined,
    };
    if (c.price !== undefined && c.compareAtPrice !== undefined && c.compareAtPrice > 0 && c.compareAtPrice <= c.price) {
      issues.push({ level: "warning", row: r.row, sku, message: "El precio anterior no es mayor que el precio: no se va a mostrar tachado." });
      c.compareAtPrice = undefined;
    }
    return c;
  };
  const productFields = (r: RowData, sku: string): ProductFields => {
    const estado = r.get("estado").toLowerCase();
    let status: ProductFields["status"];
    if (estado) {
      if (["publicado", "publicada", "published", "activo", "si", "sí"].includes(estado)) status = "published";
      else if (["borrador", "draft", "oculto", "no"].includes(estado)) status = "draft";
      else err(r.row, sku, `Estado inválido: "${r.get("estado")}" (usá publicado o borrador)`);
    }
    const dest = r.get("destacado").toLowerCase();
    let featured: boolean | undefined;
    if (dest) {
      if (YES.has(dest)) featured = true;
      else if (NO.has(dest)) featured = false;
      else err(r.row, sku, `Destacado inválido: "${r.get("destacado")}" (usá si o no)`);
    }
    const cats = r.get("categorias");
    return {
      name: r.get("nombre") || undefined,
      categories: cats ? splitList(cats).map((path) => path.split(">").map((p) => p.trim()).filter(Boolean)).filter((p) => p.length) : undefined,
      status,
      featured,
      shortDescription: r.get("descripcion_corta") || undefined,
      description: r.get("descripcion") || undefined,
      tags: r.get("etiquetas") ? splitList(r.get("etiquetas")) : undefined,
    };
  };

  // SKU repetidos dentro del archivo
  const seenSku = new Map<string, number>();
  const valid = rows.filter((r) => {
    const sku = r.get("sku");
    if (!sku) {
      issues.push({ level: "error", row: r.row, message: "Falta el SKU: la fila se omite." });
      return false;
    }
    const key = sku.toLowerCase();
    if (seenSku.has(key)) {
      issues.push({ level: "error", row: r.row, sku, message: `SKU repetido (ya está en la fila ${seenSku.get(key)}): la fila se omite.` });
      return false;
    }
    seenSku.set(key, r.row);
    return true;
  });

  const products: PlannedProduct[] = [];
  const groups = new Map<string, RowData[]>();
  for (const r of valid) {
    const group = r.get("grupo");
    if (!group) {
      rowFailed = false;
      const sku = r.get("sku");
      if (r.terms.length) issues.push({ level: "warning", row: r.row, sku, message: "Tiene valores de atributo pero no tiene grupo: los atributos solo se usan en productos con variantes y se ignoran." });
      const p = { kind: "simple" as const, row: r.row, sku, ...common(r, sku), ...productFields(r, sku) };
      if (!rowFailed) products.push(p);
      continue;
    }
    const key = group.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const sku = first.get("grupo");
    if (seenSku.has(sku.toLowerCase()) && !groupRows.some((r) => r.get("sku").toLowerCase() === sku.toLowerCase())) {
      for (const r of groupRows) issues.push({ level: "error", row: r.row, sku: r.get("sku"), message: `El grupo "${sku}" es también el SKU de otra fila. Usá un código de grupo distinto.` });
      continue;
    }
    if (groupRows.some((r) => r.get("sku").toLowerCase() === sku.toLowerCase())) {
      for (const r of groupRows) issues.push({ level: "error", row: r.row, sku: r.get("sku"), message: `El grupo "${sku}" no puede ser igual al SKU de una de sus variantes.` });
      continue;
    }

    // Datos del producto: el primer valor no vacío de cualquier fila del grupo
    rowFailed = false;
    const fields: ProductFields = {};
    for (const r of groupRows) {
      const f = productFields(r, r.get("sku"));
      for (const [k, v] of Object.entries(f) as [keyof ProductFields, never][]) if (v !== undefined && fields[k] === undefined) fields[k] = v;
    }
    if (rowFailed) continue; // estado o destacado inválido: ya quedó anotado
    const attributes = cols.attributes.map((a) => a.name).filter((name) => groupRows.some((r) => r.terms.some((t) => t.attribute === name)));
    if (!attributes.length) {
      for (const r of groupRows) issues.push({ level: "error", row: r.row, sku: r.get("sku"), message: `El grupo "${sku}" no tiene valores en ninguna columna atributo:… — cada variante necesita al menos un atributo (ej. Tamaño).` });
      continue;
    }

    const variants: PlannedVariant[] = [];
    const combos = new Map<string, number>();
    for (const r of groupRows) {
      const vsku = r.get("sku");
      rowFailed = false;
      const missing = attributes.filter((a) => !r.terms.some((t) => t.attribute === a));
      if (missing.length) err(r.row, vsku, `Falta el valor de ${missing.join(", ")} (en este grupo todas las variantes llevan ${attributes.join(" y ")}).`);
      const combo = r.terms.map((t) => `${slugify(t.attribute)}=${slugify(t.value)}`).sort().join("|");
      if (!missing.length && combos.has(combo)) err(r.row, vsku, `Misma combinación de atributos que la fila ${combos.get(combo)}.`);
      combos.set(combo, r.row);
      const c = common(r, vsku);
      if (!rowFailed) variants.push({ row: r.row, sku: vsku, terms: r.terms, ...c });
    }
    if (!variants.length) continue;
    products.push({ kind: "variable", row: first.row, sku, attributes, variants, ...fields });
  }

  products.sort((a, b) => a.row - b.row);
  issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return { products, issues };
}

// ---------- Contraste con la base y con el ZIP ----------

export type Existing = {
  products: Map<string, { id: string; type: "simple" | "variable"; attributeSlugs: string[] }>; // sku (minúsculas) →
  variants: Map<string, { id: string; productSku: string | null }>; // sku (minúsculas) →
};

export type Summary = {
  create: number;
  update: number;
  variantsCreate: number;
  variantsUpdate: number;
  images: number;
  categories: string[];
  attributes: string[];
};

// Marca qué se crea y qué se actualiza, y valida lo que depende de la base (SKU tomados, datos obligatorios al crear)
// y del ZIP (imágenes que no vinieron). Devuelve el plan final sin los productos con error.
export function checkPlan(plan: Plan, existing: Existing, zipNames: Set<string> | null): Plan & { summary: Summary } {
  const issues = [...plan.issues];
  const summary: Summary = { create: 0, update: 0, variantsCreate: 0, variantsUpdate: 0, images: 0, categories: [], attributes: [] };
  const images = new Set<string>();
  const categories = new Set<string>();
  const attributes = new Set<string>();

  const checkImages = (refs: ImageRef[] | undefined, row: number, sku: string) => {
    if (!refs) return undefined;
    const ok = refs.filter((ref) => {
      if (ref.kind === "url") return true;
      if (zipNames?.has(ref.name.toLowerCase())) return true;
      issues.push({ level: "warning", row, sku, message: zipNames ? `La imagen "${ref.name}" no está en el ZIP: se omite.` : `La imagen "${ref.name}" es un nombre de archivo pero no se subió un ZIP: se omite.` });
      return false;
    });
    ok.forEach((r) => images.add(imageKey(r)));
    return ok;
  };

  const products: PlannedProduct[] = [];
  for (const p of plan.products) {
    const fail = (row: number, sku: string, message: string) => issues.push({ level: "error", row, sku, message });
    const current = existing.products.get(p.sku.toLowerCase());
    const asVariant = existing.variants.get(p.sku.toLowerCase());

    if (p.kind === "simple") {
      if (asVariant) {
        const productOnly = (["name", "categories", "status", "featured", "shortDescription", "description", "tags"] as const).filter((k) => p[k] !== undefined);
        if (productOnly.length) issues.push({ level: "warning", row: p.row, sku: p.sku, message: "Es una variante: se actualizan precio, stock, medidas e imagen; nombre, categorías, descripción, estado y etiquetas se cargan en la fila del producto (con grupo)." });
        products.push({ ...p, kind: "variantUpdate", images: checkImages(p.images, p.row, p.sku) });
        summary.variantsUpdate++;
        continue;
      }
      if (current?.type === "variable") { fail(p.row, p.sku, "Ese SKU ya es de un producto con variantes: cargalo como grupo."); continue; }
      if (!current && !p.name) { fail(p.row, p.sku, "Producto nuevo sin nombre."); continue; }
      if (!current && p.price === undefined) { fail(p.row, p.sku, "Producto nuevo sin precio."); continue; }
      const imgs = checkImages(p.images, p.row, p.sku);
      products.push({ ...p, images: imgs });
      if (current) summary.update++;
      else summary.create++;
    } else if (p.kind === "variable") {
      if (asVariant) { fail(p.row, p.sku, `El grupo "${p.sku}" ya es el SKU de una variante.`); continue; }
      if (current?.type === "simple") { fail(p.row, p.sku, `El SKU "${p.sku}" ya es un producto simple: no se puede convertir en grupo desde el Excel.`); continue; }
      if (!current && !p.name) { fail(p.row, p.sku, `Grupo nuevo "${p.sku}" sin nombre (ponelo en la primera fila del grupo).`); continue; }
      if (current) {
        const want = p.attributes.map(slugify).sort().join(",");
        const have = [...current.attributeSlugs].sort().join(",");
        if (have && want !== have) { fail(p.row, p.sku, `El producto ya existe con otros atributos (${current.attributeSlugs.join(", ")}); el Excel trae ${p.attributes.join(", ")}.`); continue; }
      }
      const variants: PlannedVariant[] = [];
      for (const v of p.variants) {
        const ev = existing.variants.get(v.sku.toLowerCase());
        if (existing.products.has(v.sku.toLowerCase())) { fail(v.row, v.sku, "Ese SKU ya es de un producto (no de una variante)."); continue; }
        if (ev && ev.productSku?.toLowerCase() !== p.sku.toLowerCase()) { fail(v.row, v.sku, "Ese SKU ya es una variante de otro producto."); continue; }
        if (!ev && v.price === undefined) { fail(v.row, v.sku, "Variante nueva sin precio."); continue; }
        variants.push({ ...v, images: checkImages(v.images, v.row, v.sku) });
        if (ev) summary.variantsUpdate++;
        else summary.variantsCreate++;
      }
      if (!variants.length) continue;
      products.push({ ...p, variants });
      p.attributes.forEach((a) => attributes.add(a));
      if (current) summary.update++;
      else summary.create++;
    }
    p.categories?.forEach((path) => categories.add(path.join(" > ")));
  }
  summary.images = images.size;
  summary.categories = [...categories];
  summary.attributes = [...attributes];
  issues.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
  return { products, issues, summary };
}
