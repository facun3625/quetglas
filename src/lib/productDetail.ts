import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { effectivePricing } from "@/lib/pricing";
import { publishedNow } from "@/lib/catalogVisibility";

// Detalle completo de un producto publicado (página de producto y API). Se
// busca por id o por slug.
export async function getProductDetail(where: { id: string } | { slug: string }) {
  const p = await prisma.product.findFirst({
    where: { ...where, ...publishedNow() },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
      attributes: {
        where: { usedForVariations: true },
        orderBy: { sortOrder: "asc" },
        include: { attribute: { include: { terms: { orderBy: { sortOrder: "asc" } } } } },
      },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      variants: {
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
        include: { terms: { select: { termId: true } }, image: { select: { url: true, thumbUrl: true } } },
      },
    },
  });
  if (!p) return null;

  const now = new Date();
  const base = effectivePricing(p, now);
  // Solo los términos que alguna variante realmente usa
  const usedTermIds = new Set(p.variants.flatMap((v) => v.terms.map((t) => t.termId)));
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    type: p.type,
    sku: p.sku,
    shortDescription: p.shortDescription,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    updatedAt: p.updatedAt,
    // HTML cargado por el admin o migrado desde WooCommerce: se limpia siempre.
    description: p.description ? sanitizeRichHtml(p.description) : null,
    videoUrl: p.videoUrl,
    price: base.price,
    compareAtPrice: base.compareAtPrice,
    onPromo: base.onPromo,
    tags: p.tags.map((t) => t.tag),
    stock: p.manageStock ? Math.max(0, p.stock) : 9999,
    images: p.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl ?? i.url, alt: i.alt, id: i.id, videoUrl: i.videoUrl })),
    categories: p.categories.map((c) => c.category),
    options: p.attributes.map((pa) => ({
      attributeId: pa.attributeId,
      name: pa.attribute.name,
      terms: pa.attribute.terms
        .filter((t) => usedTermIds.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex })),
    })),
    variants: p.variants.map((v) => {
      const vp = effectivePricing({ ...v, promoStartsAt: p.promoStartsAt, promoEndsAt: p.promoEndsAt }, now);
      return {
      id: v.id,
      sku: v.sku,
      price: vp.price,
      compareAtPrice: vp.compareAtPrice,
      stock: v.manageStock ? Math.max(0, v.stock) : 9999,
      termIds: v.terms.map((t) => t.termId),
      image: v.image?.url ?? null,
    };
    }),
  };
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;
