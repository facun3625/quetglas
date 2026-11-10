import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import type { ProductInput } from "./actions";

// Las fechas viajan en ISO (UTC): el navegador las convierte a su zona horaria para mostrarlas
const toIso = (d: Date | null): string => (d ? d.toISOString() : "");

export const EMPTY_PRODUCT: ProductInput = {
  name: "", slug: "", sku: "", type: "simple", status: "published", shortDescription: "", description: "", videoUrl: "",
  price: 0, compareAtPrice: null, stock: 0, manageStock: true, weight: null, width: null, height: null, length: null,
  featured: false, costPrice: null, publishAt: "", unpublishAt: "", promoPrice: null, promoStartsAt: "", promoEndsAt: "", tags: [], relatedIds: [], seoTitle: "", seoDescription: "", categoryIds: [], images: [], attributeIds: [], variants: [],
};

export async function getFormOptions() {
  const [categories, attributes, tags] = await Promise.all([
    getAllCategories(),
    prisma.attribute.findMany({ orderBy: { name: "asc" }, include: { terms: { orderBy: { sortOrder: "asc" } } } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })),
    allTags: tags.map((t) => t.name),
    attributes: attributes.map((a) => ({ id: a.id, name: a.name, terms: a.terms.map((t) => ({ id: t.id, name: t.name })) })),
  };
}

export async function getProductForEdit(id: string): Promise<ProductInput | null> {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      categories: true,
      attributes: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { createdAt: "asc" }, include: { terms: true, image: true } },
      tags: { include: { tag: { select: { name: true } } } },
      related: { orderBy: { sortOrder: "asc" }, select: { relatedId: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id, name: p.name, slug: p.slug, sku: p.sku ?? "", type: p.type, status: p.status,
    shortDescription: p.shortDescription ?? "", description: p.description ?? "", videoUrl: p.videoUrl ?? "",
    price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, manageStock: p.manageStock,
    weight: p.weight, width: p.width, height: p.height, length: p.length, featured: p.featured,
    costPrice: p.costPrice, publishAt: toIso(p.publishAt), unpublishAt: toIso(p.unpublishAt),
    promoPrice: p.promoPrice, promoStartsAt: toIso(p.promoStartsAt), promoEndsAt: toIso(p.promoEndsAt),
    tags: p.tags.map((t) => t.tag.name), relatedIds: p.related.map((r) => r.relatedId),
    seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "",
    categoryIds: p.categories.map((c) => c.categoryId),
    images: p.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl, alt: i.alt ?? "", videoUrl: i.videoUrl })),
    attributeIds: p.attributes.map((a) => a.attributeId),
    variants: p.variants.map((v) => ({
      id: v.id, sku: v.sku ?? "", price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, promoPrice: v.promoPrice, stock: v.stock,
      manageStock: v.manageStock, enabled: v.enabled, termIds: v.terms.map((t) => t.termId), imageUrl: v.image?.url ?? null,
    })),
  };
}

// Nombres de los productos recomendados (para mostrarlos en el selector)
export async function getRelatedNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}
