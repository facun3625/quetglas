import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { descendantIds } from "@/lib/categoryHelpers";
import { getStoreSettingsRow } from "@/lib/settings";
import { categoryImageOverride, getThemeForRequest } from "@/lib/themeRuntime";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductListItem } from "@/types/catalog";
import { effectivePricing } from "@/lib/pricing";
import { publishedNow } from "@/lib/catalogVisibility";
import { compareByName } from "@/lib/sortNames";

// Lo que trae cada fila de un listado: primera imagen, categorías y variantes
// habilitadas (solo para calcular precio "desde" y stock de los variables).
const LIST_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" as const }, take: 1 },
  categories: { include: { category: { select: { id: true, name: true } } }, take: 1 },
  variants: { where: { enabled: true }, select: { price: true, compareAtPrice: true, promoPrice: true, stock: true, manageStock: true } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;

// Stock "infinito" visible para productos que no manejan stock.
const UNLIMITED = 9999;

export function toListItem(p: ProductRow): ProductListItem {
  const image = p.images[0];
  const category = p.categories[0]?.category;
  const now = new Date();
  let { price, compareAtPrice } = effectivePricing(p, now);
  let onSale = compareAtPrice !== null && compareAtPrice > price;
  let stock = p.manageStock ? p.stock : UNLIMITED;
  if (p.type === "variable") {
    // Con promoción programada, cada variante usa la ventana de fechas del producto
    const variantPricing = p.variants.map((v) => effectivePricing({ ...v, promoStartsAt: p.promoStartsAt, promoEndsAt: p.promoEndsAt }, now));
    const prices = variantPricing.map((vp) => vp.price);
    price = prices.length ? Math.min(...prices) : p.price;
    onSale = variantPricing.some((vp) => vp.compareAtPrice !== null && vp.compareAtPrice > vp.price);
    compareAtPrice = null;
    stock = p.variants.reduce((sum, v) => sum + (v.manageStock ? Math.max(0, v.stock) : UNLIMITED), 0);
  }
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    price,
    compareAtPrice,
    stock,
    onSale,
    image: image?.url ?? null,
    thumb: image?.thumbUrl ?? image?.url ?? null,
    hasVideo: Boolean(image?.videoUrl),
    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
  };
}

// Productos que podrían estar en oferta (el chequeo fino de fechas se hace en memoria con onSale)
const OFFER_PREFILTER: Prisma.ProductWhereInput[] = [
  { compareAtPrice: { not: null } },
  { promoPrice: { not: null } },
  { variants: { some: { enabled: true, OR: [{ compareAtPrice: { not: null } }, { promoPrice: { not: null } }] } } },
];

// Solo mostramos productos publicados y con foto — sin imagen no hay nada que
// mostrar en el grid.
function storeWhere(opts: { categoryIds?: string[]; query?: string; minPrice?: number; maxPrice?: number; tagSlug?: string }): Prisma.ProductWhereInput {
  return {
    ...publishedNow(),
    images: { some: {} },
    ...(opts.categoryIds ? { categories: { some: { categoryId: { in: opts.categoryIds } } } } : {}),
    ...(opts.tagSlug ? { tags: { some: { tag: { slug: opts.tagSlug } } } } : {}),
    ...(opts.query ? { name: { contains: opts.query, mode: "insensitive" } } : {}),
    ...(opts.minPrice !== undefined ? { price: { gte: opts.minPrice } } : {}),
    ...(opts.maxPrice !== undefined ? { price: { lte: opts.maxPrice } } : {}),
  };
}

async function categoryScope(categoryId?: string): Promise<string[] | undefined> {
  if (!categoryId) return undefined;
  return descendantIds(await getAllCategories(), categoryId);
}

// "Tiene stock" con el mismo criterio que toListItem: un producto simple sin control de stock o con unidades, o un
// variable con alguna variante habilitada sin control de stock o con unidades.
const WITH_STOCK: Prisma.ProductWhereInput = {
  OR: [
    { type: "simple", OR: [{ manageStock: false }, { stock: { gt: 0 } }] },
    { type: "variable", variants: { some: { enabled: true, OR: [{ manageStock: false }, { stock: { gt: 0 } }] } } },
  ],
};

export async function getProductsPage(opts: {
  categoryId?: string;
  query?: string;
  tagSlug?: string;
  onlyOffers?: boolean;
  limit: number;
  offset: number;
  // Categorías que van primero, en este orden (con sus subcategorías); después el resto. Solo para la vista general.
  priorityCategoryIds?: string[];
}): Promise<{ products: ProductListItem[]; total: number }> {
  const where: Prisma.ProductWhereInput = {
    ...storeWhere({ categoryIds: await categoryScope(opts.categoryId), query: opts.query, tagSlug: opts.tagSlug }),
    ...(opts.onlyOffers ? { OR: OFFER_PREFILTER } : {}),
  };

  // Filtro opcional del admin (Configuración → General): oculta del todo los productos sin stock en vez de
  // mostrarlos al final con "Sin stock" + "Avisarme".
  const settings = await getStoreSettingsRow();

  // "En oferta" es un dato derivado (fechas de la promoción): ese listado se arma en memoria
  if (opts.onlyOffers) {
    const rows = (await prisma.product.findMany({ where, include: LIST_INCLUDE })).sort(compareByName);
    const items = rows.map(toListItem).filter((p) => p.onSale && (!settings.hideOutOfStock || p.stock > 0));
    // Lo que tiene stock primero (el orden por nombre se mantiene dentro de cada grupo)
    const sorted = [...items.filter((p) => p.stock > 0), ...items.filter((p) => p.stock <= 0)];
    return { products: sorted.slice(opts.offset, opts.offset + opts.limit), total: sorted.length };
  }

  // Tramos del listado, en orden: primero las categorías prioritarias (si hay) y después el resto. Cada tramo se parte
  // en "con stock" y "sin stock", y todos los "sin stock" van al final: así un cliente siempre ve primero lo que puede
  // comprar. Si el admin oculta lo sin stock, ese segundo grupo no existe.
  const priority = opts.priorityCategoryIds ?? [];
  let byCategory: Prisma.ProductWhereInput[] = [where];
  if (priority.length > 0) {
    const all = await getAllCategories();
    const scopes = priority.map((id) => descendantIds(all, id));
    const inScope = (ids: string[]): Prisma.ProductWhereInput => ({ categories: { some: { categoryId: { in: ids } } } });
    const outOfScope = (ids: string[]): Prisma.ProductWhereInput => ({ categories: { none: { categoryId: { in: ids } } } });
    byCategory = [
      ...scopes.map((ids, i) => ({ AND: [where, inScope(ids), ...(i > 0 ? [outOfScope([...new Set(scopes.slice(0, i).flat())])] : [])] })),
      { AND: [where, outOfScope([...new Set(scopes.flat())])] },
    ];
  }
  const segments: Prisma.ProductWhereInput[] = [
    ...byCategory.map((w) => ({ AND: [w, WITH_STOCK] })),
    ...(settings.hideOutOfStock ? [] : byCategory.map((w) => ({ AND: [w, { NOT: WITH_STOCK }] }))),
  ];
  return getSegmentedPage(segments, opts.limit, opts.offset);
}

// Arma el listado como una sola lista hecha de tramos (cada uno ordenado por nombre, ver lib/sortNames.ts). De cada
// tramo se traen solo los nombres (livianos) para ordenarlos y contarlos; después se leen completos únicamente los de la
// página pedida, así la paginación sigue siendo continua y sin repetidos.
async function getSegmentedPage(
  segments: Prisma.ProductWhereInput[],
  limit: number,
  offset: number
): Promise<{ products: ProductListItem[]; total: number }> {
  const sortedIds = await Promise.all(
    segments.map(async (w) => (await prisma.product.findMany({ where: w, select: { id: true, name: true } })).sort(compareByName).map((r) => r.id))
  );
  const total = sortedIds.reduce((sum, ids) => sum + ids.length, 0);

  const pageIds: string[] = [];
  let start = 0;
  for (const ids of sortedIds) {
    const end = start + ids.length;
    const from = Math.max(offset, start);
    const to = Math.min(offset + limit, end);
    if (from < to) pageIds.push(...ids.slice(from - start, to - start));
    start = end;
  }

  const rows = pageIds.length ? await prisma.product.findMany({ where: { id: { in: pageIds } }, include: LIST_INCLUDE }) : [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return { products: pageIds.map((id) => byId.get(id)).filter((r): r is ProductRow => Boolean(r)).map(toListItem), total };
}

// Búsqueda acotada para la vendedora virtual: solo productos publicados y con
// foto, con el stock real.
export async function searchProductsForAssistant(opts: {
  query?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  limit?: number;
}): Promise<ProductListItem[]> {
  const limit = Math.min(Math.max(opts.limit ?? 6, 1), 8);
  const rows = await prisma.product.findMany({
    where: storeWhere({
      categoryIds: await categoryScope(opts.categoryId),
      query: opts.query,
      minPrice: opts.minPrice,
      maxPrice: opts.maxPrice,
    }),
    include: LIST_INCLUDE,
    orderBy: { name: "asc" },
    take: opts.inStockOnly ? limit * 3 : limit,
  });
  const items = rows.map(toListItem);
  return (opts.inStockOnly ? items.filter((p) => p.stock > 0) : items).slice(0, limit);
}

// Para favoritos: re-consulta el estado actual (precio, stock, imagen) de una
// lista puntual de ids, en el mismo orden pedido.
export async function getProductsByIds(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, ...publishedNow() },
    include: LIST_INCLUDE,
  });
  const byId = new Map(rows.map((p) => [p.id, toListItem(p)]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductListItem => !!p);
}

export type AdminProductSort = "name" | "price" | "stock" | "category";

export type AdminProductListItem = ProductListItem & {
  sku: string | null;
  status: "published" | "draft";
  // visible = se ve hoy en la tienda; scheduled = publicado pero todavía no empieza; expired = ya terminó
  visibility: "visible" | "draft" | "scheduled" | "expired";
  featured: boolean;
  manageStock: boolean;
  // Precio de lista del producto simple (el que se edita en línea)
  basePrice: number;
};

export async function getAdminProductsPage(opts: {
  query?: string;
  categoryId?: string;
  // all | visible | draft | scheduled (publicado pero fuera de fecha)
  state?: "visible" | "draft" | "scheduled";
  // simple | variable (con variantes: talle, color…)
  type?: "simple" | "variable";
  // in = hay existencia (se puede comprar); out = no hay existencia
  availability?: "in" | "out";
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  sort?: AdminProductSort;
  dir?: "asc" | "desc";
  limit: number;
  offset: number;
}): Promise<{ products: AdminProductListItem[]; total: number }> {
  const categoryIds = await categoryScope(opts.categoryId);
  const now = new Date();
  const stateWhere: Prisma.ProductWhereInput =
    opts.state === "visible"
      ? publishedNow(now)
      : opts.state === "draft"
        ? { status: "draft" }
        : opts.state === "scheduled"
          ? { status: "published", OR: [{ publishAt: { gt: now } }, { unpublishAt: { lte: now } }] }
          : {};
  const baseWhere: Prisma.ProductWhereInput = {
    ...stateWhere,
    ...(opts.type ? { type: opts.type } : {}),
    ...(categoryIds ? { categories: { some: { categoryId: { in: categoryIds } } } } : {}),
    ...(opts.query
      ? {
          OR: [
            { name: { contains: opts.query, mode: "insensitive" } },
            { sku: { contains: opts.query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(opts.minPrice !== undefined || opts.maxPrice !== undefined
      ? { price: { ...(opts.minPrice !== undefined ? { gte: opts.minPrice } : {}), ...(opts.maxPrice !== undefined ? { lte: opts.maxPrice } : {}) } }
      : {}),
  };
  // La disponibilidad se suma con AND: así no pisa el OR de la búsqueda ni el del estado "programados"
  const where: Prisma.ProductWhereInput =
    opts.availability === "in" ? { AND: [baseWhere, WITH_STOCK] } : opts.availability === "out" ? { AND: [baseWhere, { NOT: WITH_STOCK }] } : baseWhere;
  const dir = opts.dir === "desc" ? "desc" : "asc";
  const decorate = (rows: ProductRow[]): AdminProductListItem[] =>
    rows.map((p) => ({
      ...toListItem(p),
      sku: p.sku,
      status: p.status,
      featured: p.featured,
      manageStock: p.manageStock,
      basePrice: p.price,
      visibility:
        p.status === "draft"
          ? ("draft" as const)
          : p.publishAt && p.publishAt > now
            ? ("scheduled" as const)
            : p.unpublishAt && p.unpublishAt <= now
              ? ("expired" as const)
              : ("visible" as const),
    }));

  // stock/categoría son derivados (variantes / relación): se ordenan en memoria.
  const needsMemorySort = opts.sort === "stock" || opts.sort === "category" || opts.minStock !== undefined || opts.maxStock !== undefined;
  if (needsMemorySort) {
    let all = decorate((await prisma.product.findMany({ where, include: LIST_INCLUDE })).sort(compareByName));
    if (opts.minStock !== undefined) all = all.filter((p) => p.stock >= opts.minStock!);
    if (opts.maxStock !== undefined) all = all.filter((p) => p.stock <= opts.maxStock!);
    if (opts.sort === "stock") all.sort((a, b) => (dir === "asc" ? a.stock - b.stock : b.stock - a.stock));
    if (opts.sort === "category") {
      all.sort((a, b) =>
        dir === "asc" ? (a.categoryName ?? "").localeCompare(b.categoryName ?? "") : (b.categoryName ?? "").localeCompare(a.categoryName ?? "")
      );
    }
    return { products: all.slice(opts.offset, opts.offset + opts.limit), total: all.length };
  }

  // Por nombre: alfabético de verdad (sin distinguir mayúsculas ni tildes). Se ordenan solo id+nombre y se leen completos
  // los de la página.
  if (opts.sort !== "price") {
    const names = (await prisma.product.findMany({ where, select: { id: true, name: true } })).sort(compareByName);
    if (dir === "desc") names.reverse();
    const pageIds = names.slice(opts.offset, opts.offset + opts.limit).map((r) => r.id);
    const rows = pageIds.length ? await prisma.product.findMany({ where: { id: { in: pageIds } }, include: LIST_INCLUDE }) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return { products: decorate(pageIds.map((id) => byId.get(id)).filter((r): r is ProductRow => Boolean(r))), total: names.length };
  }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: [{ price: dir }, { name: "asc" }, { id: "asc" }],
      take: opts.limit,
      skip: opts.offset,
    }),
    prisma.product.count({ where }),
  ]);
  return { products: decorate(rows), total };
}

// Cuenta productos publicados por categoría (incluyendo sus descendientes).
export async function getProductCountsByCategory(
  categories: { id: string; parentId: string | null }[]
): Promise<Map<string, number>> {
  const links = await prisma.productCategory.findMany({
    where: { product: { ...publishedNow(), images: { some: {} } } },
    select: { productId: true, categoryId: true },
  });
  const productsByCategory = new Map<string, Set<string>>();
  for (const l of links) {
    if (!productsByCategory.has(l.categoryId)) productsByCategory.set(l.categoryId, new Set());
    productsByCategory.get(l.categoryId)!.add(l.productId);
  }

  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId) childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
  }

  // Un producto en varias subcategorías cuenta una sola vez en el padre.
  const collect = (id: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(id)) return new Set();
    seen.add(id);
    const set = new Set(productsByCategory.get(id) ?? []);
    for (const child of childrenOf.get(id) ?? []) for (const p of collect(child, seen)) set.add(p);
    return set;
  };

  return new Map(categories.map((c) => [c.id, collect(c.id).size]));
}

// Imagen representativa de una categoría: la propia, o la del primer producto
// publicado de la categoría (o sus descendientes).
export async function getCategoryShowcaseImage(categoryId: string): Promise<string | null> {
  const [categories, theme] = await Promise.all([getAllCategories(), getThemeForRequest()]);
  const own = categoryImageOverride(theme, categoryId) ?? categories.find((c) => c.id === categoryId)?.imageUrl;
  if (own) return own;

  const image = await prisma.productImage.findFirst({
    where: {
      product: {
        ...publishedNow(),
        categories: { some: { categoryId: { in: descendantIds(categories, categoryId) } } },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
    select: { url: true },
  });
  return image?.url ?? null;
}

// Productos recomendados para la página de un producto: los elegidos a mano; si no hay, los de su misma categoría.
export async function getRelatedProducts(productId: string, categoryIds: string[], limit = 4): Promise<ProductListItem[]> {
  const manual = await prisma.productRelation.findMany({
    where: { productId, related: { ...publishedNow(), images: { some: {} } } },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: { related: { include: LIST_INCLUDE } },
  });
  if (manual.length > 0) return manual.map((m) => toListItem(m.related));
  if (categoryIds.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { ...storeWhere({ categoryIds }), NOT: { id: productId } },
    include: LIST_INCLUDE,
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return rows.map(toListItem);
}

// Productos destacados (marcados en el panel) y en oferta (promoción activa o precio tachado), para el inicio
export async function getFeaturedProducts(limit = 12): Promise<ProductListItem[]> {
  const rows = await prisma.product.findMany({
    where: { ...storeWhere({}), featured: true },
    include: LIST_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map(toListItem);
}

export async function getOfferProducts(limit = 12): Promise<ProductListItem[]> {
  const rows = await prisma.product.findMany({
    where: {
      ...storeWhere({}),
      OR: OFFER_PREFILTER,
    },
    include: LIST_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: limit * 3,
  });
  // Se descartan promos vencidas o que todavía no empezaron
  return rows.map(toListItem).filter((p) => p.onSale).slice(0, limit);
}
