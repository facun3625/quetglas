import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductDetail } from "@/lib/productDetail";
import { getStoreSettingsRow } from "@/lib/settings";
import { getRelatedProducts } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";
import { siteUrl } from "@/lib/siteUrl";
import { JsonLd } from "@/components/JsonLd";
import { ProductDetailView } from "./ProductDetailView";

type Props = { params: Promise<{ slug: string }> };

const plain = (html: string | null | undefined) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail({ slug });
  if (!product) return {};
  const description = product.seoDescription || plain(product.shortDescription) || plain(product.description).slice(0, 160) || undefined;
  const title = product.seoTitle || product.name;
  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/producto/${product.slug}` },
    openGraph: { title, description, type: "website", images: product.images[0] ? [product.images[0].url] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductDetail({ slug }), getStoreSettingsRow()]);
  if (!product) notFound();

  const base = siteUrl();
  const prices = product.type === "variable" ? product.variants.map((v) => v.price) : [product.price];
  const inStock = product.type === "variable" ? product.variants.some((v) => v.stock > 0) : product.stock > 0;
  const absolute = (url: string) => (url.startsWith("http") ? url : `${base}${url}`);
  const offer = {
    "@type": prices.length > 1 && Math.min(...prices) !== Math.max(...prices) ? "AggregateOffer" : "Offer",
    priceCurrency: settings.currency,
    ...(prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? { lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length }
      : { price: Math.min(...prices) }),
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url: `${base}/producto/${product.slug}`,
  };
  const category = product.categories[0];
  const related = await getRelatedProducts(product.id, product.categories.map((c) => c.id));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: plain(product.shortDescription) || plain(product.description).slice(0, 500) || undefined,
          sku: product.sku ?? undefined,
          image: product.images.map((i) => absolute(i.url)),
          offers: offer,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Tienda", item: `${base}/tienda` },
            ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: `${base}/categoria/${category.slug}` }] : []),
            { "@type": "ListItem", position: category ? 3 : 2, name: product.name, item: `${base}/producto/${product.slug}` },
          ],
        }}
      />
      <ProductDetailView product={product} />
      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-3 pb-14 sm:px-6">
          <h2 className="mb-4 text-xl font-bold text-brand-ink">También te puede interesar</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
