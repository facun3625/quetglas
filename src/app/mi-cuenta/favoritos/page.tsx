import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductsByIds } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

export default async function MisFavoritosPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Mis favoritos</h1>
        <p className="mt-2 text-brand-muted">Iniciá sesión para ver los productos que guardaste.</p>
      </div>
    );
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
  });
  const products = await getProductsByIds(favorites.map((f) => f.productId)); // ya viene en orden "guardado más reciente primero"

  return (
    <div className="mx-auto max-w-6xl px-3 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Mis favoritos</h1>
      <p className="mt-1 text-brand-muted">Productos que guardaste para más adelante.</p>

      {products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-brand-muted">Todavía no guardaste ningún producto.</p>
          <Link
            href="/tienda"
            className="mt-4 inline-block rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark"
          >
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
