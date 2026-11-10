import Link from "next/link";

// Tarjeta de categoría compartida por el carrusel del inicio (CategoryCarousel)
// y la grilla de tarjetas de la tienda (CategoryCardGrid): la imagen ocupa toda
// la tarjeta y el nombre + botón quedan flotando arriba, no abajo de la imagen.
export function CategoryTile({ slug, name, image }: { slug: string; name: string; image: string | null }) {
  return (
    <Link
      href={`/categoria/${slug}`}
      className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/10 transition-shadow hover:shadow-md"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-brand-soft" />
      )}

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-full bg-white py-2 pl-4 pr-2 shadow-md ring-1 ring-black/10 transition-colors group-hover:bg-brand-pink">
        <p className="truncate text-xs font-bold uppercase tracking-wide text-brand-ink transition-colors group-hover:text-white">
          {name}
        </p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-white transition-colors group-hover:bg-white group-hover:text-brand-pink-dark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
