"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { parseCsv } from "@/lib/csv";
import { normalizeVideoUrl } from "@/lib/video";
import { stockFieldsFor, type StockMode } from "@/lib/stockMode";

export type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  sku: string;
  type: "simple" | "variable";
  status: "published" | "draft";
  shortDescription: string;
  description: string;
  videoUrl: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  manageStock: boolean;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
  featured: boolean;
  costPrice: number | null;
  // Fechas en ISO (UTC) o vacías
  publishAt: string;
  unpublishAt: string;
  promoPrice: number | null;
  promoStartsAt: string;
  promoEndsAt: string;
  tags: string[];
  relatedIds: string[];
  seoTitle: string;
  seoDescription: string;
  categoryIds: string[];
  // Si la imagen es la portada de un video, videoUrl es el archivo del video
  images: { url: string; thumbUrl: string | null; alt: string; videoUrl?: string | null }[];
  // Atributos que definen las variantes (solo productos variables)
  attributeIds: string[];
  variants: {
    id?: string;
    sku: string;
    price: number;
    compareAtPrice: number | null;
    costPrice?: number | null;
    promoPrice?: number | null;
    stock: number;
    manageStock: boolean;
    enabled: boolean;
    termIds: string[];
    imageUrl: string | null;
  }[];
};

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

const nullIfEmpty = (v: string) => (v.trim() ? v.trim() : null);
const money = (n: number) => Number.isFinite(n) && n >= 0;
const toDate = (v: string): Date | null => {
  if (!v?.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function validate(input: ProductInput): string | null {
  if (!input.name.trim()) return "El nombre es obligatorio";
  if (!money(input.price)) return "El precio no es válido";
  if (input.compareAtPrice !== null && !money(input.compareAtPrice)) return "El precio anterior no es válido";
  if (!Number.isInteger(input.stock)) return "El stock debe ser un número entero";
  if (input.costPrice !== null && !money(input.costPrice)) return "El precio de costo no es válido";
  for (const [label, value] of [["de publicación", input.publishAt], ["de despublicación", input.unpublishAt], ["de inicio de la promoción", input.promoStartsAt], ["de fin de la promoción", input.promoEndsAt]] as const) {
    if (value?.trim() && !toDate(value)) return `La fecha ${label} no es válida`;
  }
  const publishAt = toDate(input.publishAt), unpublishAt = toDate(input.unpublishAt);
  if (publishAt && unpublishAt && unpublishAt <= publishAt) return "La despublicación tiene que ser posterior a la publicación";
  const promoStart = toDate(input.promoStartsAt), promoEnd = toDate(input.promoEndsAt);
  if (promoStart && promoEnd && promoEnd <= promoStart) return "El fin de la promoción tiene que ser posterior al inicio";
  if (input.type === "simple" && input.promoPrice !== null) {
    if (!money(input.promoPrice)) return "El precio promocional no es válido";
    if (input.promoPrice >= input.price) return "El precio promocional tiene que ser menor al precio normal";
  }
  if (input.type === "variable") {
    if (input.attributeIds.length === 0) return "Elegí al menos un atributo para las variantes";
    if (input.variants.length === 0) return "Generá al menos una variante";
    const seen = new Set<string>();
    for (const v of input.variants) {
      if (!money(v.price)) return "Hay una variante con precio inválido";
      if (v.promoPrice !== null && v.promoPrice !== undefined && (!money(v.promoPrice) || v.promoPrice >= v.price)) return "Una variante tiene un precio promocional inválido (debe ser menor a su precio)";
      if (v.costPrice !== null && v.costPrice !== undefined && !money(v.costPrice)) return "Una variante tiene un costo inválido";
      if (!Number.isInteger(v.stock)) return "Hay una variante con stock inválido";
      if (v.termIds.length !== input.attributeIds.length) return "Cada variante necesita un valor por atributo";
      const key = [...v.termIds].sort().join("|");
      if (seen.has(key)) return "Hay variantes repetidas (misma combinación)";
      seen.add(key);
    }
  }
  return null;
}

export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  await requireAdmin();
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  try {
    const id = await prisma.$transaction(async (tx) => {
      const slug = await uniqueSlug(input.slug.trim() || input.name, async (candidate) =>
        Boolean(await tx.product.findFirst({ where: { slug: candidate, ...(input.id ? { NOT: { id: input.id } } : {}) }, select: { id: true } }))
      );
      const data = {
        name: input.name.trim(),
        slug,
        sku: nullIfEmpty(input.sku),
        type: input.type,
        status: input.status,
        shortDescription: input.shortDescription.replace(/<[^>]+>/g, "").trim() ? sanitizeRichHtml(input.shortDescription) : null,
        description: input.description.trim() ? sanitizeRichHtml(input.description) : null,
        videoUrl: nullIfEmpty(input.videoUrl),
        price: input.type === "variable" ? 0 : input.price,
        compareAtPrice: input.type === "variable" ? null : input.compareAtPrice,
        stock: input.type === "variable" ? 0 : input.stock,
        manageStock: input.manageStock,
        weight: input.weight,
        width: input.width,
        height: input.height,
        length: input.length,
        featured: input.featured,
        costPrice: input.costPrice,
        publishAt: toDate(input.publishAt),
        unpublishAt: toDate(input.unpublishAt),
        promoPrice: input.type === "simple" ? input.promoPrice : null,
        promoStartsAt: toDate(input.promoStartsAt),
        promoEndsAt: toDate(input.promoEndsAt),
        seoTitle: nullIfEmpty(input.seoTitle),
        seoDescription: nullIfEmpty(input.seoDescription),
      };
      const product = input.id
        ? await tx.product.update({ where: { id: input.id }, data })
        : await tx.product.create({ data });

      // Categorías y atributos: se reemplazan completos.
      await tx.productCategory.deleteMany({ where: { productId: product.id } });
      if (input.categoryIds.length) {
        await tx.productCategory.createMany({ data: input.categoryIds.map((categoryId) => ({ productId: product.id, categoryId })) });
      }
      // Etiquetas (se crean las que no existan) y productos recomendados
      await tx.productTag.deleteMany({ where: { productId: product.id } });
      // Sin duplicados por slug ("Regalo" y "regalo" son la misma etiqueta)
      const tagsBySlug = new Map<string, string>();
      for (const raw of input.tags) {
        const name = raw.trim();
        if (name && !tagsBySlug.has(slugify(name))) tagsBySlug.set(slugify(name), name);
      }
      for (const [slug, name] of [...tagsBySlug].slice(0, 30)) {
        const tag = await tx.tag.upsert({ where: { slug }, create: { name: name.slice(0, 60), slug }, update: {} });
        await tx.productTag.create({ data: { productId: product.id, tagId: tag.id } });
      }
      await tx.productRelation.deleteMany({ where: { productId: product.id } });
      const relatedIds = [...new Set(input.relatedIds)].filter((r) => r !== product.id).slice(0, 12);
      if (relatedIds.length) {
        const existing = await tx.product.findMany({ where: { id: { in: relatedIds } }, select: { id: true } });
        const ok = new Set(existing.map((e) => e.id));
        await tx.productRelation.createMany({ data: relatedIds.filter((r) => ok.has(r)).map((relatedId, sortOrder) => ({ productId: product.id, relatedId, sortOrder })) });
      }
      await tx.productAttribute.deleteMany({ where: { productId: product.id } });
      if (input.type === "variable") {
        await tx.productAttribute.createMany({
          data: input.attributeIds.map((attributeId, i) => ({ productId: product.id, attributeId, sortOrder: i })),
        });
      }

      // Imágenes: se conservan las existentes (por url), se crean las nuevas y se borran las quitadas.
      const existingImages = await tx.productImage.findMany({ where: { productId: product.id } });
      const keepUrls = new Set(input.images.map((i) => i.url));
      const removed = existingImages.filter((i) => !keepUrls.has(i.url)).map((i) => i.id);
      if (removed.length) await tx.productImage.deleteMany({ where: { id: { in: removed } } });
      const imageIdByUrl = new Map(existingImages.filter((i) => keepUrls.has(i.url)).map((i) => [i.url, i.id]));
      for (const [index, image] of input.images.entries()) {
        const existingId = imageIdByUrl.get(image.url);
        if (existingId) {
          await tx.productImage.update({ where: { id: existingId }, data: { sortOrder: index, alt: nullIfEmpty(image.alt) } });
        } else {
          const created = await tx.productImage.create({
            data: { productId: product.id, url: image.url, thumbUrl: image.thumbUrl, alt: nullIfEmpty(image.alt), sortOrder: index, videoUrl: normalizeVideoUrl(image.videoUrl ?? "") || null },
          });
          imageIdByUrl.set(image.url, created.id);
        }
      }

      // Variantes: se sincronizan por id (las quitadas se borran; los pedidos conservan su copia).
      const keepVariantIds = input.variants.map((v) => v.id).filter((v): v is string => Boolean(v));
      await tx.variant.deleteMany({
        where: { productId: product.id, ...(input.type === "variable" ? { id: { notIn: keepVariantIds } } : {}) },
      });
      if (input.type === "variable") {
        for (const v of input.variants) {
          const variantData = {
            sku: nullIfEmpty(v.sku),
            price: v.price,
            compareAtPrice: v.compareAtPrice,
            costPrice: v.costPrice ?? null,
            promoPrice: v.promoPrice ?? null,
            stock: v.stock,
            manageStock: v.manageStock,
            enabled: v.enabled,
            imageId: v.imageUrl ? (imageIdByUrl.get(v.imageUrl) ?? null) : null,
          };
          const variant = v.id
            ? await tx.variant.update({ where: { id: v.id }, data: variantData })
            : await tx.variant.create({ data: { ...variantData, productId: product.id } });
          await tx.variantAttributeTerm.deleteMany({ where: { variantId: variant.id } });
          await tx.variantAttributeTerm.createMany({ data: v.termIds.map((termId) => ({ variantId: variant.id, termId })) });
        }
      }
      return product.id;
    });

    await logAdminAction(input.id ? "product.update" : "product.create", { targetType: "product", targetId: id, detail: input.name });
    revalidatePath("/admin/productos");
    revalidatePath("/tienda");
    revalidatePath("/");
    return { ok: true, id };
  } catch (err) {
    if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
      console.error("saveProduct unique constraint violation", err);
      const target = (err as { meta?: { target?: string | string[] } }).meta?.target;
      const fields = Array.isArray(target) ? target.join(",") : String(target ?? "");
      const error = /sku/i.test(fields)
        ? "Ya existe otro producto o variante con ese SKU"
        : /slug/i.test(fields)
          ? "Ya existe otro producto con esa URL (slug). Cambiá el nombre o la URL."
          : "Ya existe otro registro con ese valor (clave duplicada)";
      return { ok: false, error };
    }
    console.error("saveProduct failed", err);
    return { ok: false, error: "No se pudo guardar el producto" };
  }
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const product = await prisma.product.delete({ where: { id }, select: { name: true } });
  await logAdminAction("product.delete", { targetType: "product", targetId: id, detail: product.name });
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
}

export async function setProductStatus(id: string, status: "published" | "draft") {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { status } });
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
}

// ---- Categorías ----

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const parentId = String(formData.get("parentId") ?? "") || null;
  if (id && parentId === id) return;

  // No permitir ciclos: el nuevo padre no puede ser descendiente de la categoría.
  if (id && parentId) {
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === id) return;
      cursor = (await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
    }
  }

  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = await uniqueSlug(slugInput || name, async (candidate) =>
    Boolean(await prisma.category.findFirst({ where: { slug: candidate, ...(id ? { NOT: { id } } : {}) }, select: { id: true } }))
  );
  const data = {
    name,
    slug,
    description: nullIfEmpty(String(formData.get("description") ?? "")),
    imageUrl: nullIfEmpty(String(formData.get("imageUrl") ?? "")),
    parentId,
    sortOrder: Number(formData.get("sortOrder")) || 0,
  };
  if (id) await prisma.category.update({ where: { id }, data });
  else await prisma.category.create({ data });
  revalidatePath("/admin/categorias");
  revalidatePath("/tienda");
  revalidatePath("/");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  // Las subcategorías suben un nivel (parentId queda en null por el schema) y los productos pierden el vínculo.
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categorias");
  revalidatePath("/tienda");
}

// ---- Atributos ----

export async function saveAttribute(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const slug = await uniqueSlug(name, async (candidate) =>
    Boolean(await prisma.attribute.findFirst({ where: { slug: candidate, ...(id ? { NOT: { id } } : {}) }, select: { id: true } }))
  );

  // Un término por línea; "Rojo|#ff0000" agrega un color.
  const lines = String(formData.get("terms") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const terms = [...new Map(lines.map((line) => {
    const [label, color] = line.split("|").map((p) => p.trim());
    return [slugify(label), { name: label, slug: slugify(label), colorHex: /^#[0-9a-f]{6}$/i.test(color ?? "") ? color : null }] as const;
  })).values()];

  await prisma.$transaction(async (tx) => {
    const attribute = id
      ? await tx.attribute.update({ where: { id }, data: { name, slug } })
      : await tx.attribute.create({ data: { name, slug } });
    const existing = await tx.attributeTerm.findMany({ where: { attributeId: attribute.id } });
    const keep = new Set(terms.map((t) => t.slug));
    // Los términos quitados se borran (arrastra las variantes que los usaban: se avisa en la pantalla).
    await tx.attributeTerm.deleteMany({ where: { id: { in: existing.filter((t) => !keep.has(t.slug)).map((t) => t.id) } } });
    const bySlug = new Map(existing.map((t) => [t.slug, t]));
    for (const [index, term] of terms.entries()) {
      const found = bySlug.get(term.slug);
      if (found) await tx.attributeTerm.update({ where: { id: found.id }, data: { name: term.name, colorHex: term.colorHex, sortOrder: index } });
      else await tx.attributeTerm.create({ data: { ...term, attributeId: attribute.id, sortOrder: index } });
    }
  });
  revalidatePath("/admin/atributos");
}

export async function deleteAttribute(id: string) {
  await requireAdmin();
  await prisma.attribute.delete({ where: { id } });
  revalidatePath("/admin/atributos");
}

// ---- Importación CSV de precios y stock (se matchea por SKU) ----

export type CsvImportResult = { ok: true; updated: number; notFound: string[]; invalid: string[] } | { ok: false; error: string };

export async function importPriceStockCsv(formData: FormData): Promise<CsvImportResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí un archivo CSV" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "El archivo supera los 5 MB" };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { ok: false, error: "El archivo no tiene filas" };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [skuCol, priceCol, compareCol, stockCol] = [col("sku"), col("precio"), col("precio_anterior"), col("stock")];
  if (skuCol < 0 || (priceCol < 0 && stockCol < 0 && compareCol < 0)) {
    return { ok: false, error: "Faltan columnas: se necesita 'sku' y al menos una de 'precio', 'precio_anterior' o 'stock'" };
  }

  let updated = 0;
  const notFound: string[] = [];
  const invalid: string[] = [];
  for (const [index, row] of rows.slice(1).entries()) {
    const sku = row[skuCol]?.trim();
    if (!sku) continue;
    const data: { price?: number; compareAtPrice?: number | null; stock?: number } = {};
    const parse = (cell: string | undefined) => (cell === undefined || cell.trim() === "" ? undefined : Number(cell.replace(",", ".")));
    const price = priceCol >= 0 ? parse(row[priceCol]) : undefined;
    const compare = compareCol >= 0 ? parse(row[compareCol]) : undefined;
    const stock = stockCol >= 0 ? parse(row[stockCol]) : undefined;
    if ((price !== undefined && !money(price)) || (compare !== undefined && !money(compare)) || (stock !== undefined && !Number.isInteger(stock))) {
      invalid.push(`fila ${index + 2} (${sku})`);
      continue;
    }
    if (price !== undefined) data.price = price;
    if (compare !== undefined) data.compareAtPrice = compare;
    if (stock !== undefined) data.stock = stock;
    if (Object.keys(data).length === 0) continue;

    const variant = await prisma.variant.updateMany({ where: { sku }, data });
    if (variant.count > 0) { updated += variant.count; continue; }
    const product = await prisma.product.updateMany({ where: { sku, type: "simple" }, data });
    if (product.count > 0) updated += product.count;
    else notFound.push(sku);
  }
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  return { ok: true, updated, notFound: notFound.slice(0, 50), invalid: invalid.slice(0, 50) };
}

// ---- Edición rápida, acciones masivas y duplicado ----

export async function quickUpdateProduct(
  id: string,
  patch: { price?: number; stock?: number; stockMode?: StockMode }
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const data: { price?: number; stock?: number; manageStock?: boolean } = {};
  if (patch.price !== undefined) {
    if (!money(patch.price)) return { ok: false, error: "Precio inválido" };
    data.price = patch.price;
  }
  if (patch.stockMode !== undefined) {
    if (!["available", "unavailable", "tracked"].includes(patch.stockMode)) return { ok: false, error: "Existencia inválida" };
    if (patch.stock !== undefined && (!Number.isInteger(patch.stock) || patch.stock < 0)) return { ok: false, error: "El stock debe ser un entero de 0 en adelante" };
    Object.assign(data, stockFieldsFor(patch.stockMode, patch.stock ?? 0));
  } else if (patch.stock !== undefined) {
    if (!Number.isInteger(patch.stock)) return { ok: false, error: "El stock debe ser entero" };
    data.stock = patch.stock;
  }
  const product = await prisma.product.findUnique({ where: { id }, select: { type: true, promoPrice: true } });
  if (!product || product.type !== "simple") return { ok: false, error: "Solo se edita en línea un producto simple" };
  if (data.price !== undefined && product.promoPrice !== null && product.promoPrice >= data.price) {
    return { ok: false, error: "El precio no puede ser menor o igual al precio promocional cargado" };
  }
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  return { ok: true };
}

export type BulkAction =
  | { type: "publish" }
  | { type: "draft" }
  | { type: "feature"; value: boolean }
  | { type: "addCategory"; categoryId: string }
  | { type: "removeCategory"; categoryId: string }
  | { type: "adjustPrice"; percent: number }
  // Hay existencia / No hay existencia (también para todas las variantes de los productos con variantes)
  | { type: "stockMode"; mode: "available" | "unavailable" }
  | { type: "delete" };

export async function bulkProductAction(ids: string[], action: BulkAction): Promise<{ ok: boolean; affected: number; error?: string }> {
  await requireAdmin();
  const unique = [...new Set(ids)].slice(0, 1000);
  if (unique.length === 0) return { ok: false, affected: 0, error: "No hay productos seleccionados" };
  const where = { id: { in: unique } };
  let affected = 0;

  switch (action.type) {
    case "publish":
      affected = (await prisma.product.updateMany({ where, data: { status: "published" } })).count;
      break;
    case "draft":
      affected = (await prisma.product.updateMany({ where, data: { status: "draft" } })).count;
      break;
    case "feature":
      affected = (await prisma.product.updateMany({ where, data: { featured: action.value } })).count;
      break;
    case "addCategory": {
      const category = await prisma.category.findUnique({ where: { id: action.categoryId }, select: { id: true } });
      if (!category) return { ok: false, affected: 0, error: "La categoría no existe" };
      const res = await prisma.productCategory.createMany({ data: unique.map((productId) => ({ productId, categoryId: category.id })), skipDuplicates: true });
      affected = res.count;
      break;
    }
    case "removeCategory":
      affected = (await prisma.productCategory.deleteMany({ where: { productId: { in: unique }, categoryId: action.categoryId } })).count;
      break;
    case "adjustPrice": {
      // Sube o baja el precio de lista un porcentaje (también el de las variantes), redondeado a centavos
      if (!Number.isFinite(action.percent) || action.percent <= -90 || action.percent > 500 || action.percent === 0) {
        return { ok: false, affected: 0, error: "El porcentaje debe estar entre -90 y 500 (y no ser 0)" };
      }
      const factor = 1 + action.percent / 100;
      const round = (n: number) => Math.round(n * factor * 100) / 100;
      const products = await prisma.product.findMany({ where, select: { id: true, price: true, compareAtPrice: true, promoPrice: true, variants: { select: { id: true, price: true, compareAtPrice: true, promoPrice: true } } } });
      await prisma.$transaction(async (tx) => {
        for (const p of products) {
          await tx.product.update({ where: { id: p.id }, data: { price: round(p.price), compareAtPrice: p.compareAtPrice === null ? null : round(p.compareAtPrice), promoPrice: p.promoPrice === null ? null : round(p.promoPrice) } });
          for (const v of p.variants) {
            await tx.variant.update({ where: { id: v.id }, data: { price: round(v.price), compareAtPrice: v.compareAtPrice === null ? null : round(v.compareAtPrice), promoPrice: v.promoPrice === null ? null : round(v.promoPrice) } });
          }
        }
      });
      affected = products.length;
      break;
    }
    case "stockMode": {
      if (action.mode !== "available" && action.mode !== "unavailable") return { ok: false, affected: 0, error: "Existencia inválida" };
      const fields = stockFieldsFor(action.mode);
      await prisma.$transaction(async (tx) => {
        affected = (await tx.product.updateMany({ where, data: fields })).count;
        await tx.variant.updateMany({ where: { productId: { in: unique } }, data: fields });
      });
      break;
    }
    case "delete":
      affected = (await prisma.product.deleteMany({ where })).count;
      break;
  }
  await logAdminAction("product.update", { targetType: "product", detail: `Acción masiva "${action.type}" sobre ${affected} producto(s)` });
  revalidatePath("/admin/productos");
  revalidatePath("/tienda");
  revalidatePath("/");
  return { ok: true, affected };
}

// Copia un producto como borrador (sin SKU, para no chocar con el original)
export async function duplicateProduct(id: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireAdmin();
  const p = await prisma.product.findUnique({
    where: { id },
    include: { images: true, categories: true, tags: true, related: true, attributes: true, variants: { include: { terms: true } } },
  });
  if (!p) return { ok: false, error: "El producto ya no existe" };

  const copyId = await prisma.$transaction(async (tx) => {
    const name = `Copia de ${p.name}`.slice(0, 200);
    const slug = await uniqueSlug(name, async (s) => Boolean(await tx.product.findUnique({ where: { slug: s }, select: { id: true } })));
    const copy = await tx.product.create({
      data: {
        name, slug, sku: null, type: p.type, status: "draft", shortDescription: p.shortDescription, description: p.description, videoUrl: p.videoUrl,
        price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, manageStock: p.manageStock,
        weight: p.weight, width: p.width, height: p.height, length: p.length, featured: false, costPrice: p.costPrice,
        promoPrice: p.promoPrice, promoStartsAt: p.promoStartsAt, promoEndsAt: p.promoEndsAt,
        seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      },
    });
    const imageIdMap = new Map<string, string>();
    for (const img of p.images) {
      const created = await tx.productImage.create({ data: { productId: copy.id, url: img.url, thumbUrl: img.thumbUrl, alt: img.alt, sortOrder: img.sortOrder, videoUrl: img.videoUrl } });
      imageIdMap.set(img.id, created.id);
    }
    if (p.categories.length) await tx.productCategory.createMany({ data: p.categories.map((c) => ({ productId: copy.id, categoryId: c.categoryId })) });
    if (p.tags.length) await tx.productTag.createMany({ data: p.tags.map((t) => ({ productId: copy.id, tagId: t.tagId })) });
    if (p.related.length) await tx.productRelation.createMany({ data: p.related.map((r) => ({ productId: copy.id, relatedId: r.relatedId, sortOrder: r.sortOrder })) });
    if (p.attributes.length) await tx.productAttribute.createMany({ data: p.attributes.map((a) => ({ productId: copy.id, attributeId: a.attributeId, usedForVariations: a.usedForVariations, visible: a.visible, sortOrder: a.sortOrder })) });
    for (const v of p.variants) {
      const variant = await tx.variant.create({
        data: {
          productId: copy.id, sku: null, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, promoPrice: v.promoPrice,
          stock: v.stock, manageStock: v.manageStock, enabled: v.enabled, weight: v.weight, width: v.width, height: v.height, length: v.length,
          imageId: v.imageId ? (imageIdMap.get(v.imageId) ?? null) : null,
        },
      });
      if (v.terms.length) await tx.variantAttributeTerm.createMany({ data: v.terms.map((t) => ({ variantId: variant.id, termId: t.termId })) });
    }
    return copy.id;
  });
  await logAdminAction("product.create", { targetType: "product", targetId: copyId, detail: `Duplicado de ${p.name}` });
  revalidatePath("/admin/productos");
  return { ok: true, id: copyId };
}

// ---- Etiquetas ----

export async function renameTag(id: string, name: string) {
  await requireAdmin();
  const text = name.trim().slice(0, 60);
  if (!text) return;
  const slug = await uniqueSlug(text, async (s) => Boolean(await prisma.tag.findFirst({ where: { slug: s, NOT: { id } }, select: { id: true } })));
  await prisma.tag.update({ where: { id }, data: { name: text, slug } });
  revalidatePath("/admin/etiquetas");
}

export async function deleteTag(id: string) {
  await requireAdmin();
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/admin/etiquetas");
}
