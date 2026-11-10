import { prisma } from "@/lib/prisma";
import { TagRow } from "./TagRow";

export default async function AdminEtiquetasPage() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-brand-ink">Etiquetas</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Las etiquetas se crean al cargar un producto (campo “Etiquetas”). Acá podés renombrarlas o borrarlas. En la tienda, cada
        etiqueta tiene su propio listado (<code>/tienda?etiqueta=…</code>).
      </p>
      <div className="mt-6 divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
        {tags.map((t) => (
          <TagRow key={t.id} id={t.id} name={t.name} slug={t.slug} products={t._count.products} />
        ))}
        {tags.length === 0 && <p className="p-5 text-center text-sm text-brand-muted">Todavía no hay etiquetas.</p>}
      </div>
    </div>
  );
}
