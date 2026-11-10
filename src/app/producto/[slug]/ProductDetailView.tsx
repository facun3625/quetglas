"use client";

import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";
import { useMoney } from "@/lib/currency";
import { isStaff } from "@/lib/roles";
import { CartIcon, PencilIcon } from "@/components/icons";
import { WaitlistModal } from "@/components/WaitlistModal";
import type { ProductDetail } from "@/lib/productDetail";

export function ProductDetailView({ product }: { product: ProductDetail }) {
  const { addItem } = useCart();
  const { formatMoney } = useMoney();
  const { data: session } = useSession();
  const isAdmin = isStaff(session?.user?.role);
  const isVariable = product.type === "variable";
  const [imageIndex, setImageIndex] = useState(0);
  // atributo -> término elegido
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  // Variante que coincide con todas las opciones elegidas (si ya se eligieron todas).
  const variant = useMemo(() => {
    if (!isVariable) return null;
    if (product.options.some((o) => !selected[o.attributeId])) return null;
    const chosen = new Set(Object.values(selected));
    return product.variants.find((v) => v.termIds.length === chosen.size && v.termIds.every((t) => chosen.has(t))) ?? null;
  }, [isVariable, product, selected]);

  // Un término está disponible si existe alguna variante con stock que lo combine con lo ya elegido.
  function termAvailable(attributeId: string, termId: string) {
    const others = Object.entries(selected).filter(([attr]) => attr !== attributeId).map(([, t]) => t);
    return product.variants.some(
      (v) => v.termIds.includes(termId) && others.every((t) => v.termIds.includes(t)) && v.stock > 0
    );
  }

  const prices = product.variants.map((v) => v.price);
  const price = variant ? variant.price : isVariable ? Math.min(...prices) : product.price;
  const compareAtPrice = variant ? variant.compareAtPrice : isVariable ? null : product.compareAtPrice;
  const stock = variant ? variant.stock : isVariable ? null : product.stock;
  const hasDiscount = compareAtPrice !== null && compareAtPrice > price;
  const outOfStock = stock !== null && stock <= 0;
  const needsSelection = isVariable && !variant;

  const variantImage = variant?.image;
  const images = product.images;
  const mainImage = variantImage ?? images[imageIndex]?.url ?? null;
  // Si el lugar elegido de la galería es un video (y no hay una foto de variante elegida), se muestra el reproductor
  const mainVideo = !variantImage ? images[imageIndex]?.videoUrl ?? null : null;
  const variantLabel = variant
    ? product.options
        .map((o) => o.terms.find((t) => t.id === selected[o.attributeId])?.name)
        .filter(Boolean)
        .join(" / ")
    : undefined;

  function handleAdd() {
    if (needsSelection || outOfStock) return;
    addItem(
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        name: product.name,
        variantLabel,
        price,
        image: mainImage,
        maxStock: stock ?? 9999,
        categoryId: product.categories[0]?.id,
      },
      quantity
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6 flex items-center justify-between gap-3 text-xs text-brand-muted">
        <span>
          <Link href="/tienda" className="hover:text-brand-pink-dark">Tienda</Link>
          {product.categories[0] && (
            <>
              {" / "}
              <Link href={`/categoria/${product.categories[0].slug}`} className="hover:text-brand-pink-dark">
                {product.categories[0].name}
              </Link>
            </>
          )}
        </span>
        {isAdmin && (
          <Link
            href={`/admin/productos/${product.id}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 font-semibold uppercase tracking-wide text-brand-ink transition-colors hover:border-brand-pink hover:text-brand-pink-dark"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Editar producto
          </Link>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-brand-soft">
            {mainVideo ? (
              // key: al cambiar de video se vuelve a armar el reproductor. preload="metadata": no baja el video hasta que se toca play
              <video
                key={mainVideo}
                src={mainVideo}
                poster={mainImage ?? undefined}
                controls
                playsInline
                preload="metadata"
                aria-label={`Video de ${product.name}`}
                className="h-full w-full bg-black/5 object-contain"
              />
            ) : (
              mainImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mainImage} alt={product.name} className="h-full w-full object-cover" />
              )
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  className={`h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${
                    i === imageIndex && !variantImage ? "border-brand-pink" : "border-transparent"
                  }`}
                >
                  <span className="relative block h-full w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumbUrl} alt={img.alt ?? ""} className="h-full w-full object-cover" />
                    {img.videoUrl && (
                      <span className="absolute inset-0 flex items-center justify-center" aria-label="Video">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-brand-ink sm:text-3xl">{product.name}</h1>
          {product.sku && <p className="mt-1 text-xs text-brand-muted">SKU: {variant?.sku ?? product.sku}</p>}

          <div className="mt-4 flex items-baseline gap-3">
            <p className="text-2xl font-bold text-brand-pink-dark">
              {needsSelection && <span className="mr-1 text-xs font-medium uppercase text-brand-muted">Desde</span>}
              {formatMoney(price)}
            </p>
            {hasDiscount && <p className="text-sm text-brand-muted line-through">{formatMoney(compareAtPrice!)}</p>}
          </div>

          {product.shortDescription && <div className="rich-content mt-4 text-sm text-brand-ink/80" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.shortDescription) }} />}
          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Link key={t.id} href={`/tienda?etiqueta=${t.slug}`} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink hover:bg-brand-pink/10">
                  #{t.name}
                </Link>
              ))}
            </div>
          )}

          {isVariable &&
            product.options.map((option) => (
              <div key={option.attributeId} className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-muted">{option.name}</p>
                <div className="flex flex-wrap gap-2">
                  {option.terms.map((term) => {
                    const active = selected[option.attributeId] === term.id;
                    const available = termAvailable(option.attributeId, term.id);
                    return (
                      <button
                        key={term.id}
                        type="button"
                        onClick={() =>
                          setSelected((prev) => ({ ...prev, [option.attributeId]: active ? "" : term.id }))
                        }
                        title={available ? undefined : "Sin stock"}
                        className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-brand-pink bg-brand-pink text-white"
                            : available
                              ? "border-black/15 text-brand-ink hover:border-brand-pink"
                              : "border-black/10 text-brand-muted line-through"
                        }`}
                      >
                        {term.colorHex && (
                          <span
                            className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/20 align-middle"
                            style={{ backgroundColor: term.colorHex }}
                          />
                        )}
                        {term.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          <div className="mt-6 flex items-center gap-3">
            {!outOfStock && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="h-10 w-10 cursor-pointer rounded-full border border-black/15 hover:bg-brand-soft"
                  aria-label="Restar"
                >
                  −
                </button>
                <span className="w-8 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(stock ?? 9999, q + 1))}
                  className="h-10 w-10 cursor-pointer rounded-full border border-black/15 hover:bg-brand-soft"
                  aria-label="Sumar"
                >
                  +
                </button>
              </div>
            )}

            {outOfStock ? (
              <button
                type="button"
                onClick={() => setWaitlistOpen(true)}
                className="flex-1 cursor-pointer rounded-full border-2 border-brand-pink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-brand-pink-dark hover:bg-brand-pink hover:text-white"
              >
                Avisarme cuando haya stock
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                disabled={needsSelection}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CartIcon className="h-4 w-4" />
                {needsSelection ? "Elegí una opción" : "Agregar al carrito"}
              </button>
            )}
          </div>
          {stock !== null && stock > 0 && stock <= 5 && (
            <p className="mt-2 text-xs font-medium text-amber-700">¡Quedan {stock} unidades!</p>
          )}

          {product.description && (
            <div className="mt-8 border-t border-black/10 pt-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-muted">Descripción</h2>
              <div
                className="rich-content max-w-none text-sm text-brand-ink/80"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(product.description) }}
              />
            </div>
          )}
        </div>
      </div>

      {waitlistOpen && (
        <WaitlistModal
          productId={product.id}
          productName={product.name}
          categoryName={product.categories[0]?.name}
          onClose={() => setWaitlistOpen(false)}
        />
      )}
    </div>
  );
}
