import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CategoryForm } from "./CategoryForm";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [cat, all] = await Promise.all([
    prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true, children: true } } } }),
    prisma.category.findMany({ select: { id: true, name: true, parentId: true } }),
  ]);
  if (!cat) notFound();

  // El padre no puede ser ella misma ni sus descendientes
  const children = new Map<string | null, string[]>();
  for (const c of all) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id]);
  const blocked = new Set<string>([id]);
  const stack = [id];
  while (stack.length) for (const k of children.get(stack.pop()!) ?? []) if (!blocked.has(k)) { blocked.add(k); stack.push(k); }
  const byId = new Map(all.map((c) => [c.id, c]));
  const label = (c: { id: string; name: string; parentId: string | null }) => {
    const names = [c.name];
    let cursor = c.parentId ? byId.get(c.parentId) : undefined;
    for (let i = 0; cursor && i < 10; i++) {
      names.unshift(cursor.name);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return names.join(" › ");
  };
  const parentOptions = all.filter((c) => !blocked.has(c.id)).map((c) => ({ id: c.id, label: label(c) })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto pb-10">
      <Link href="/admin/categorias" className="text-sm font-medium text-brand-pink-dark hover:underline">← Volver a Categorías</Link>
      <CategoryForm
        id={cat.id}
        products={cat._count.products}
        subcategories={cat._count.children}
        parentOptions={parentOptions}
        initial={{
          name: cat.name,
          slug: cat.slug,
          parentId: cat.parentId ?? "",
          sortOrder: cat.sortOrder,
          description: cat.description ?? "",
          comingSoonMessage: cat.comingSoonMessage ?? "",
          imageUrl: cat.imageUrl ?? "",
          seoTitle: cat.seoTitle ?? "",
          seoDescription: cat.seoDescription ?? "",
        }}
      />
    </div>
  );
}
