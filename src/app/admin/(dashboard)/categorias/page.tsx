import Link from "next/link";
import { LiveSearch } from "@/components/admin/LiveSearch";
import { prisma } from "@/lib/prisma";
import { NewCategoryForm } from "./NewCategoryForm";
import { DeleteCategoryButton } from "./DeleteCategoryButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Row = { id: string; name: string; slug: string; imageUrl: string | null; parentId: string | null; products: number; children: number };

export default async function AdminCategoriasPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, imageUrl: true, parentId: true, _count: { select: { products: true, children: true } } },
  });
  const all: Row[] = rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl, parentId: c.parentId, products: c._count.products, children: c._count.children }));
  const byId = new Map(all.map((c) => [c.id, c]));

  // Orden de árbol (cada categoría debajo de su padre) con su profundidad; con búsqueda, lista plana con la ruta del padre
  const tree: { cat: Row; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    for (const cat of all.filter((c) => c.parentId === parentId)) {
      if (seen.has(cat.id)) continue;
      seen.add(cat.id);
      tree.push({ cat, depth });
      walk(cat.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());
  const pathOf = (c: Row) => {
    const names: string[] = [];
    let cursor = c.parentId ? byId.get(c.parentId) : undefined;
    for (let i = 0; cursor && i < 10; i++) {
      names.unshift(cursor.name);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return names.join(" › ");
  };
  const listed = q ? tree.filter(({ cat }) => cat.name.toLowerCase().includes(q.toLowerCase())).map(({ cat }) => ({ cat, depth: 0 })) : tree;

  const pages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const shown = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const href = (p: number) => `/admin/categorias?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Categorías</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Árbol de categorías con niveles ilimitados. Entrá a una categoría para editar su nombre, padre, imagen y SEO. Al borrar una,
            sus subcategorías suben al nivel superior y los productos no se borran.
          </p>
        </div>
        <LiveSearch defaultValue={q} placeholder="Buscar categoría…" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <NewCategoryForm options={all.map((c) => ({ id: c.id, label: [pathOf(c), c.name].filter(Boolean).join(" › ") })).sort((a, b) => a.label.localeCompare(b.label))} />

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-brand-soft/40 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Productos</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ cat, depth }) => (
                <tr key={cat.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3" style={{ paddingLeft: depth * 20 }}>
                      {cat.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-brand-soft" />
                      )}
                      <div className="min-w-0">
                        <Link href={`/admin/categorias/${cat.id}`} className="font-semibold text-brand-ink hover:text-brand-pink-dark hover:underline">
                          {depth > 0 && <span className="mr-1 text-brand-muted/60">—</span>}
                          {cat.name}
                        </Link>
                        {q && pathOf(cat) && <span className="block text-xs text-brand-muted">en {pathOf(cat)}</span>}
                        <div className="mt-0.5 flex items-center gap-3 text-xs">
                          <Link href={`/admin/categorias/${cat.id}`} className="font-medium text-brand-pink-dark hover:underline">Editar</Link>
                          <DeleteCategoryButton id={cat.id} name={cat.name} products={cat.products} subcategories={cat.children} />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-brand-muted">/{cat.slug}</td>
                  <td className="px-4 py-2.5">
                    {cat.products > 0 ? (
                      <Link href={`/admin/productos?categoryId=${cat.id}`} className="font-medium text-brand-pink-dark hover:underline">{cat.products}</Link>
                    ) : (
                      <span className="text-brand-muted">0</span>
                    )}
                    {cat.children > 0 && <span className="block text-xs text-brand-muted">{cat.children} subcategoría{cat.children === 1 ? "" : "s"}</span>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">{q ? "Ninguna categoría coincide." : "Todavía no hay categorías. Creá la primera a la izquierda."}</td>
                </tr>
              )}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-black/10 px-4 py-2.5 text-xs text-brand-muted">
              {page > 1 ? <Link href={href(page - 1)} className="font-semibold hover:text-brand-ink">← Anterior</Link> : <span className="opacity-30">← Anterior</span>}
              <span>Página {page} de {pages} · {listed.length} categorías</span>
              {page < pages ? <Link href={href(page + 1)} className="font-semibold hover:text-brand-ink">Siguiente →</Link> : <span className="opacity-30">Siguiente →</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
