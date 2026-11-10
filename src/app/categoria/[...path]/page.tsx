import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopView } from "@/components/ShopView";
import { getAllCategories } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/siteUrl";

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ q?: string; page?: string; etiqueta?: string; ofertas?: string; todos?: string }>;
};

// Acepta /categoria/<slug>, /categoria/<id> y rutas anidadas al estilo WooCommerce
// (/categoria/ropa/remeras): se usa el último tramo.
async function resolveCategory(path: string[]) {
  const key = decodeURIComponent(path[path.length - 1] ?? "");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(key)) return null;
  const categories = await getAllCategories();
  return categories.find((c) => c.slug === key) ?? categories.find((c) => c.id === key) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await resolveCategory((await params).path);
  if (!category) return {};
  const full = await prisma.category.findUnique({ where: { id: category.id }, select: { seoTitle: true, seoDescription: true, description: true } });
  return {
    title: full?.seoTitle || category.name,
    description: full?.seoDescription || full?.description?.replace(/<[^>]+>/g, " ").trim().slice(0, 160) || undefined,
    alternates: { canonical: `${siteUrl()}/categoria/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await resolveCategory((await params).path);
  if (!category) notFound();
  return <ShopView categoryId={category.id} searchParams={await searchParams} />;
}
