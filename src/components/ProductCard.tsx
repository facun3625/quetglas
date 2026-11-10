"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ProductListItem } from "@/types/catalog";
import { useMoney } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { useAuthModal } from "@/lib/authModal";
import { isStaff } from "@/lib/roles";
import { CartIcon, BellIcon, HeartIcon, PencilIcon } from "@/components/icons";
import { ProductImage } from "@/components/ProductImage";
import { WaitlistModal } from "@/components/WaitlistModal";

export function ProductCard({ product }: { product: ProductListItem }) {
  const { addItem } = useCart();
  const { formatMoney } = useMoney();
  const { data: session, status } = useSession();
  const { isFavorite, toggle } = useFavorites();
  const { openLogin } = useAuthModal();
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const outOfStock = product.stock <= 0;
  const isVariable = product.type === "variable";
  const categoryName = product.categoryName ?? undefined;
  const hasDiscount = product.compareAtPrice !== null && product.compareAtPrice > product.price;
  const favorite = isFavorite(product.id);
  const isAdmin = isStaff(session?.user?.role);

  function handleToggleFavorite() {
    if (status !== "authenticated") {
      openLogin();
      return;
    }
    toggle(product.id);
  }

  return (
    <div className="min-w-0 rounded-xl border border-brand-pink/15 bg-white p-3 transition-all hover:border-brand-pink/50 hover:shadow-md sm:p-4">
      <div className="relative">
        <ProductImage productId={product.id} thumbnail={product.thumb} alt={product.name} />
        {product.hasVideo && (
          <span className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-medium text-white" title="Tiene video">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3"><path d="M8 5v14l11-7z" /></svg>
            Video
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          aria-pressed={favorite}
          className={`absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 shadow transition-colors hover:bg-brand-pink hover:text-white ${
            favorite ? "text-brand-pink-dark" : "text-brand-ink"
          }`}
        >
          <HeartIcon className={`h-4 w-4 ${favorite ? "fill-current" : "fill-none"}`} />
        </button>
        {isAdmin && (
          <Link
            href={`/admin/productos/${product.id}`}
            title="Editar producto"
            aria-label="Editar producto"
            className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow transition-colors hover:bg-brand-pink hover:text-white"
          >
            <PencilIcon className="h-4 w-4" />
          </Link>
        )}
      </div>

      {categoryName && (
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-brand-pink-dark">
          <span className="h-px w-3 bg-brand-pink" />
          {categoryName}
        </p>
      )}
      <Link href={`/producto/${product.slug}`} className="break-words text-sm font-medium text-brand-ink hover:text-brand-pink-dark">
        {product.name}
      </Link>
      <div className="mt-1 flex items-center gap-2">
        <p className={`text-sm font-bold ${outOfStock ? "text-brand-ink" : "text-brand-pink-dark"}`}>
          {isVariable && <span className="mr-1 text-[10px] font-medium uppercase text-brand-muted">Desde</span>}
          {formatMoney(product.price)}
        </p>
        {hasDiscount && (
          <p className="text-xs text-brand-muted line-through">{formatMoney(product.compareAtPrice!)}</p>
        )}
        {outOfStock && (
          <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-muted" />
            Sin stock
          </span>
        )}
      </div>

      {outOfStock ? (
        <button
          onClick={() => setWaitlistOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-pink px-3 py-[6px] text-center text-xs font-semibold uppercase tracking-wide text-brand-pink-dark transition-colors hover:bg-brand-pink hover:text-white"
        >
          <BellIcon className="h-3.5 w-3.5 shrink-0" />
          Avisarme
        </button>
      ) : isVariable ? (
        <Link
          href={`/producto/${product.slug}`}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-pink py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-pink-dark"
        >
          Ver opciones
        </Link>
      ) : (
        <button
          onClick={() =>
            addItem({
              productId: product.id,
              variantId: null,
              name: product.name,
              price: product.price,
              image: product.thumb,
              maxStock: product.stock,
              categoryId: product.categoryId ?? undefined,
            })
          }
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-pink py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-pink-dark"
        >
          <CartIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="min-[750px]:hidden">Agregar</span>
          <span className="hidden min-[750px]:inline">Agregar al carrito</span>
        </button>
      )}

      {waitlistOpen && (
        <WaitlistModal
          productId={product.id}
          productName={product.name}
          categoryName={categoryName}
          onClose={() => setWaitlistOpen(false)}
        />
      )}
    </div>
  );
}
