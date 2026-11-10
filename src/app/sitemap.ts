import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/siteUrl";
import { publishedNow } from "@/lib/catalogVisibility";

export const dynamic = "force-dynamic";

// Sitemap generado desde la base: productos publicados con imagen, categorías y páginas activas.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories, pages] = await Promise.all([
    prisma.product.findMany({ where: { ...publishedNow(), images: { some: {} } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 45000 }),
    prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.page.findMany({ where: { enabled: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/tienda`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/categoria/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...pages.map((p) => ({ url: `${base}/pagina/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
