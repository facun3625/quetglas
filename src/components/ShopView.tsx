import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllCategories } from "@/lib/categories";
import { topLevelCategories, childrenOf } from "@/lib/categoryHelpers";
import { getProductsPage, getProductCountsByCategory } from "@/lib/products";
import { getStoreSettingsRow } from "@/lib/settings";
import { categoryImageOverride, getThemeForRequest } from "@/lib/themeRuntime";
import { CategorySidebar } from "@/components/CategorySidebar";
import { CategoryCardGrid } from "@/components/CategoryCardGrid";
import { ShopControls } from "@/components/ShopControls";
import { ProductCard } from "@/components/ProductCard";
import { Pagination } from "@/components/Pagination";
import { ScrollToTop } from "@/components/ScrollToTop";
import { logSearch } from "@/lib/searchLog";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

const PAGE_SIZE = 24;

export async function ShopView({
  categoryId,
  searchParams,
}: {
  categoryId?: string;
  searchParams: { q?: string; page?: string; etiqueta?: string; ofertas?: string; todos?: string };
}) {
  const query = searchParams.q?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const tagSlug = /^[a-z0-9-]{1,80}$/.test(searchParams.etiqueta ?? "") ? searchParams.etiqueta : undefined;
  const onlyOffers = searchParams.ofertas === "1";
  const showAll = searchParams.todos === "1";
  const [categories, settings, theme] = await Promise.all([getAllCategories(), getStoreSettingsRow(), getThemeForRequest()]);
  // Orden elegido en Configuración: solo en la vista general (sin categoría, búsqueda ni filtros) y solo con
  // categorías que todavía existen
  const known = new Set(categories.map((c) => c.id));
  const priorityCategoryIds = !categoryId && !query && !tagSlug && !onlyOffers ? settings.shopPriorityCategoryIds.filter((id) => known.has(id)) : [];

  let category = null;
  if (categoryId) {
    category = categories.find((c) => c.id === categoryId);
    if (!category) notFound();
  }

  const basePath = category ? `/categoria/${category.slug}` : "/tienda";

  const [counts, { products, total }] = await Promise.all([
    getProductCountsByCategory(categories),
    getProductsPage({
      categoryId,
      query: query || undefined,
      tagSlug,
      onlyOffers,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      priorityCategoryIds,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Búsqueda enviada (solo la primera página: paginar no es otra búsqueda)
  if (query && page === 1) logSearch(query, total);

  // Una categoría con cartel de "todavía sin productos" (Category.comingSoonMessage) cuenta
  // como "con contenido" en el menú/sidebar/tarjetas aunque tenga 0 productos reales — el
  // conteo real (`counts`) se sigue usando para decidir si se muestra la grilla o el cartel.
  const effectiveCounts = new Map(counts);
  for (const c of categories) {
    if (c.comingSoonMessage && (effectiveCounts.get(c.id) ?? 0) === 0) effectiveCounts.set(c.id, 1);
  }

  // Modo "tarjetas" (Configuración → navegar por categorías en tarjetas): el sidebar sigue
  // igual siempre; lo único que cambia es qué se muestra del lado del contenido — en vez de
  // la grilla de productos, las subcategorías del nivel actual como tarjetas, y recién se cae
  // a los productos en una categoría sin hijos (o forzado con "Ver todos los productos").
  const children = category ? childrenOf(categories, category.id) : topLevelCategories(categories);
  const visibleChildren = children.filter((c) => (effectiveCounts.get(c.id) ?? 0) > 0);
  const showCards =
    settings.categoryDrilldownEnabled && !query && !tagSlug && !onlyOffers && !showAll && visibleChildren.length > 0;
  const hasOwnProducts = !!category && (counts.get(category.id) ?? 0) > 0;

  return (
    <div className="min-h-screen bg-white px-3 py-3 sm:px-6 sm:py-4">
      <ScrollToTop watch={`${categoryId ?? "all"}-${query}-${page}`} />
      <main className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold text-brand-ink">{category ? category.name : "Tienda"}</h1>
        <p className="mb-5 text-brand-muted">
          {showCards
            ? "Elegí una categoría para seguir viendo."
            : category
              ? `${total} productos`
              : "Elegí una categoría para ver los productos."}
        </p>

        <div className="flex flex-col gap-8 sm:flex-row">
          <CategorySidebar
            categories={categories}
            counts={effectiveCounts}
            activeCategoryId={categoryId}
          />

          <div className="min-w-0 flex-1">
            <ShopControls query={query} />
            {(tagSlug || onlyOffers) && (
              <p className="mt-3 text-sm text-brand-ink">
                Filtrando por {onlyOffers ? "ofertas" : `etiqueta “${tagSlug}”`}.{" "}
                <a href={basePath} className="font-medium text-brand-pink-dark hover:underline">Quitar filtro</a>
              </p>
            )}

            {showCards ? (
              <>
                <div className="mt-5">
                  <CategoryCardGrid
                    categories={visibleChildren.map((c) => ({
                      id: c.id,
                      slug: c.slug,
                      name: c.name,
                      image: categoryImageOverride(theme, c.id) ?? c.imageUrl,
                    }))}
                  />
                </div>
                {hasOwnProducts && (
                  <p className="mt-6 text-center text-sm">
                    <Link href={`${basePath}?todos=1`} className="font-medium text-brand-pink-dark hover:underline">
                      Ver todos los productos de {category?.name}
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-4 mt-4 text-xs uppercase tracking-widest text-brand-muted">
                  Mostrando <span className="font-semibold text-brand-pink-dark">{products.length}</span> de{" "}
                  {total} productos
                </p>

                {products.length === 0 ? (
                  category?.comingSoonMessage ? (
                    <div className="rounded-xl border border-black/10 bg-brand-soft/40 px-6 py-10 text-center">
                      <div
                        className="rich-content mx-auto max-w-xl text-sm text-brand-ink/80"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(category.comingSoonMessage) }}
                      />
                    </div>
                  ) : (
                    <p className="text-brand-muted">No encontramos productos.</p>
                  )
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                      {products.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>

                    <Pagination
                      basePath={basePath}
                      query={query || undefined}
                      extraParams={{ etiqueta: tagSlug, ofertas: onlyOffers ? "1" : undefined }}
                      currentPage={page}
                      totalPages={totalPages}
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
