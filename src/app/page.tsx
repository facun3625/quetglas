import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { siteUrl } from "@/lib/siteUrl";
import { getThemeForRequest } from "@/lib/themeRuntime";
import { getAllCategories } from "@/lib/categories";
import { getProductsPage, getCategoryShowcaseImage, getFeaturedProducts, getOfferProducts } from "@/lib/products";
import { getSiteSettings } from "@/lib/settings";
import { getCashDiscountPct } from "@/lib/paymentSettings";
import { ProductCarousel } from "@/components/ProductCarousel";
import { CategoryCarousel } from "@/components/CategoryCarousel";
import { NewsletterBanner } from "@/components/NewsletterBanner";
import { HeroSlider, type HeroSlide } from "@/components/HeroSlider";
import { BenefitsStrip } from "@/components/BenefitsStrip";
import { ensureBaseTheme } from "@/lib/baseTheme";
import { sanitizeThemeConfig, type ThemeSlide } from "@/lib/themes";
import { StoreMap, type StoreLocation } from "@/components/StoreMap";
import type { ProductListItem } from "@/types/catalog";

import { storeNameOf } from "@/lib/storeName";
// Cantidad de categorías de nivel superior que se usan como fallback del slide
// de ejemplo y de "Explorá por categoría" cuando el admin no eligió ninguna.
const FALLBACK_CATEGORY_COUNT = 4;

export default async function Home() {
  let hero: { id: string; slug: string; name: string; image: string | null }[] = [];
  let featured: { id: string; slug: string; name: string; image: string | null }[] = [];
  let carouselProducts: ProductListItem[] = [];
  let offerProducts: ProductListItem[] = [];
  let error: string | null = null;

  const [settings, cashDiscountPct] = await Promise.all([
    getSiteSettings(),
    getCashDiscountPct(),
  ]);

  try {
    const categories = await getAllCategories();
    const byId = new Map(categories.map((c) => [c.id, c]));
    const topLevelIds = categories.filter((c) => c.parentId === null).map((c) => c.id);
    const heroIds = topLevelIds.slice(0, FALLBACK_CATEGORY_COUNT);
    // El orden siempre sigue el de Categorías (campo "Orden" de cada una, mismo orden que el
    // menú de la tienda) — aunque se hayan elegido a mano en Configuración en otro orden.
    const orderIndex = new Map(categories.map((c, i) => [c.id, i]));
    const featuredIds = (
      settings.featuredCategoryIds.length > 0 ? settings.featuredCategoryIds : topLevelIds.slice(0, 6)
    )
      .slice()
      .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

    const [heroResults, featuredResults, carouselResults] = await Promise.all([
      Promise.all(
        heroIds.map(async (id) => {
          const category = byId.get(id);
          if (!category) return null;
          const image = await getCategoryShowcaseImage(id);
          return { id, slug: category.slug, name: category.name, image };
        })
      ),
      Promise.all(
        featuredIds.map(async (id) => {
          const category = byId.get(id);
          if (!category) return null;
          const image = await getCategoryShowcaseImage(id);
          return { id, slug: category.slug, name: category.name, image };
        })
      ),
      Promise.all(
        featuredIds.map((id) => getProductsPage({ categoryId: id, limit: 4, offset: 0 }))
      ),
    ]);

    hero = heroResults.filter((c): c is NonNullable<typeof c> => c !== null && c.image !== null);
    featured = featuredResults.filter((c): c is NonNullable<typeof c> => c !== null && c.image !== null);
    carouselProducts = carouselResults.flatMap((r) => r.products);
    // "Destacados" = los marcados en el panel; si todavía no marcó ninguno, se muestran los de las categorías destacadas
    if (settings.home.featuredEnabled) {
      const flagged = await getFeaturedProducts();
      if (flagged.length > 0) carouselProducts = flagged;
    }
    if (settings.home.offersEnabled) offerProducts = await getOfferProducts();
  } catch (err) {
    error = err instanceof Error ? err.message : "Error desconocido";
  }

  // Las tarjetas se reparten el ancho: hasta 4 por fila, y con 5 o 6 quedan 3 por fila
const CARD_GRID = ["", "grid-cols-1 mx-auto max-w-xs", "grid-cols-2", "grid-cols-2 sm:grid-cols-3", "grid-cols-2 sm:grid-cols-4", "grid-cols-2 sm:grid-cols-3", "grid-cols-2 sm:grid-cols-3"];

const MARQUEE_ITEMS = settings.marqueeItems;

  // La dirección se guarda como un solo string ("Calle 123 — Santa
  // Fe, Argentina") — la separamos en dos líneas para la tarjeta de "Dónde
  // estamos". Si no tiene el separador (dirección cargada distinto), la
  // segunda línea cae en la franquicia como fallback razonable.
  const [addressStreet, addressCity] = settings.address.includes(" — ")
    ? settings.address.split(" — ")
    : [settings.address, settings.franchiseLocation];

  // Locales del mapa: una pestaña por tarjeta de "Datos de contacto" que tenga dirección. Sin tarjetas con dirección,
  // se usa la dirección general de la tienda (sin pestañas).
  const cardLocations: StoreLocation[] = settings.contactCards
    .filter((c) => c.address)
    .map((c) => ({ id: c.id, title: c.title, street: c.address!, city: settings.franchiseLocation, query: `${c.address}, ${settings.franchiseLocation}` }));
  // Sin tarjetas con dirección ni dirección general cargada, no hay nada que mostrar y la sección "Dónde estamos" no aparece
  const locations: StoreLocation[] =
    cardLocations.length > 0
      ? cardLocations
      : settings.address
        ? [{ id: "tienda", title: "Tienda", street: addressStreet, city: addressCity, query: settings.address }]
        : [];

  // El slider se maneja dentro de cada tema (Temas y campañas). Si el tema vigente no tiene slides propios, se usa el slider
  // del aspecto base. Si tampoco hay, un slide de ejemplo con las categorías destacadas.
  const theme = await getThemeForRequest();
  const toSlide = (s: ThemeSlide): HeroSlide => ({
    image: s.image,
    videoUrl: s.videoUrl || null,
    eyebrow: s.eyebrow,
    title: s.title,
    subtitle: s.subtitle || null,
    promoText: s.promoText || null,
    buttons: s.buttons,
  });
  const baseHero = theme && theme.config.hero.length > 0 ? theme.config.hero : sanitizeThemeConfig((await ensureBaseTheme())?.config).hero;
  const heroSlides: HeroSlide[] =
    baseHero.length > 0
      ? baseHero.map(toSlide)
      : [
          {
            image: "/hero-bg.jpg",
            eyebrow: storeNameOf(settings),
            title: "Bienvenido\na la tienda",
            subtitle: "Descubrí el catálogo completo y comprá online.",
            promoText: "Nueva\nColección",
            buttons: [
              ...hero.slice(0, 3).map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
              { label: "Ver todo", href: "/tienda" },
            ],
          },
        ];

  const base = siteUrl();
  const storeName = storeNameOf(settings);

  return (
    <div>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: storeName, url: base, email: settings.contactEmail || undefined, sameAs: settings.instagramHandle ? [`https://instagram.com/${settings.instagramHandle}`] : undefined },
            { "@type": "WebSite", name: storeName, url: base, potentialAction: { "@type": "SearchAction", target: `${base}/tienda?q={search_term_string}`, "query-input": "required name=search_term_string" } },
          ],
        }}
      />
      {/* Hero */}
      <section className="px-3 pb-8 pt-6 sm:px-6 sm:pb-12 sm:pt-10">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/tienda"
            className="mb-3 flex items-center justify-center rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-pink-dark sm:hidden"
          >
            Ir a la tienda
          </Link>

          <HeroSlider slides={heroSlides} />

          {/* Marquee de promociones + franja de beneficios, fusionados en un
              solo módulo (oscuro arriba, blanco abajo) en vez de dos
              rectángulos flotando por separado. */}
          <div className="mt-3 overflow-hidden rounded-t-3xl bg-brand-ink py-3">
            <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
              {Array(12)
                .fill(MARQUEE_ITEMS)
                .flat()
                .map((text, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-10 text-xs font-semibold uppercase tracking-[0.25em] text-white/90"
                  >
                    {text}
                    <span className="text-brand-pink">✦</span>
                  </span>
                ))}
            </div>
          </div>

          <BenefitsStrip
            cashDiscountPct={cashDiscountPct}
            franchiseLocation={settings.franchiseLocation}
            address={settings.address}
            overrides={settings.benefits}
            items={settings.homeBenefits}
          />
        </div>
      </section>

      {/* Tarjetas destacadas del tema (se cargan en Temas y campañas → Tarjetas destacadas) */}
      {theme && theme.config.banners.length > 0 && (
        <section className="px-3 pb-8 pt-0 sm:px-6 sm:pb-10">
          <div className="mx-auto max-w-6xl">
            {theme.config.bannersTitle && <h2 className="text-2xl font-bold text-brand-ink">{theme.config.bannersTitle}</h2>}
            <div className={`grid gap-3 sm:gap-4 ${theme.config.bannersTitle ? "mt-5" : ""} ${CARD_GRID[Math.min(theme.config.banners.length, 6)]}`}>
              {theme.config.banners.map((b, i) => {
                const card = (
                  <>
                    <div className="aspect-[4/3] w-full overflow-hidden bg-brand-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.image} alt={b.alt || b.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    </div>
                    {b.title && <p className="px-3 py-2.5 text-center text-sm font-semibold text-brand-ink">{b.title}</p>}
                  </>
                );
                const cls = "group block overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm";
                return b.href ? (
                  <a key={i} href={b.href} className={`${cls} transition-shadow hover:shadow-md`}>{card}</a>
                ) : (
                  <div key={i} className={cls}>{card}</div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Categorías destacadas */}
      <section className="px-3 pb-10 pt-0 sm:px-6">
        <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between min-[420px]:gap-4">
          <div>
            <h2 className="text-2xl font-bold text-brand-ink">Explorá por categoría</h2>
            <p className="mt-1 text-brand-muted">Los rubros más elegidos de la tienda.</p>
          </div>
          <Link
            href="/tienda"
            className="shrink-0 text-sm font-medium text-brand-pink-dark hover:underline"
          >
            Ver todas las categorías →
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">No se pudo cargar el catálogo</p>
            <p className="mt-1 font-mono text-xs opacity-80">{error}</p>
          </div>
        )}

        <div className="mt-8">
          <CategoryCarousel categories={featured} />
        </div>
        </div>
      </section>

      {/* Ofertas y promociones */}
      {offerProducts.length > 0 && (
        <section className="px-3 pb-6 pt-0 sm:px-6 sm:pb-10">
          <div className="mx-auto max-w-6xl rounded-3xl border border-brand-pink/20 bg-white p-4 sm:p-10">
            <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between min-[420px]:gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-pink-dark">
                  <span className="h-px w-4 bg-brand-pink" />
                  Rebajas
                </p>
                <h2 className="mt-1 text-2xl font-bold text-brand-ink">{settings.home.offersTitle}</h2>
              </div>
              <Link href="/tienda?ofertas=1" className="shrink-0 text-sm font-medium text-brand-pink-dark hover:underline">
                Ver todas las ofertas →
              </Link>
            </div>
            <div className="mt-8">
              <ProductCarousel products={offerProducts} />
            </div>
          </div>
        </section>
      )}

      {/* Productos destacados */}
      {settings.home.featuredEnabled && carouselProducts.length > 0 && (
        <section className="px-3 pb-6 pt-0 sm:px-6 sm:pb-10">
          <div className="mx-auto max-w-6xl rounded-3xl bg-brand-soft p-4 sm:p-10">
            <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between min-[420px]:gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand-pink-dark">
                  <span className="h-px w-4 bg-brand-pink" />
                  Productos destacados
                </p>
                <h2 className="mt-1 text-2xl font-bold text-brand-ink">{settings.home.featuredTitle}</h2>
              </div>
              <Link
                href="/tienda"
                className="shrink-0 text-sm font-medium text-brand-pink-dark hover:underline"
              >
                Ver todos los productos →
              </Link>
            </div>

            <div className="mt-8">
              <ProductCarousel products={carouselProducts} />
            </div>
          </div>
        </section>
      )}

      {/* Dónde estamos */}
      {locations.length > 0 && (
        <section id="donde-estamos" className="scroll-mt-36 px-3 py-5 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <StoreMap locations={locations} franchiseLocation={settings.franchiseLocation} />
          </div>
        </section>
      )}

      {/* Newsletter */}
      <NewsletterBanner storeName={storeName} />
    </div>
  );
}
