import Link from "next/link";
import { LiveSearch } from "@/components/admin/LiveSearch";
import { prisma } from "@/lib/prisma";
import { NewAttributeForm } from "./NewAttributeForm";
import { DeleteAttributeButton } from "./DeleteAttributeButton";

export const dynamic = "force-dynamic";

export default async function AdminAtributosPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const attributes = await prisma.attribute.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    include: { terms: { orderBy: { sortOrder: "asc" }, take: 8, select: { name: true } }, _count: { select: { products: true, terms: true } } },
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Atributos</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Talle, color, material… Cada atributo tiene sus valores (S, M, L…). Se usan en los productos variables para armar las variantes.
            Entrá a un atributo para ver y editar sus valores.
          </p>
        </div>
        <LiveSearch defaultValue={q} placeholder="Buscar atributo…" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <NewAttributeForm />

        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-brand-soft/40 text-xs uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Valores</th>
                <th className="px-4 py-3 font-semibold">Productos</th>
              </tr>
            </thead>
            <tbody>
              {attributes.map((a) => (
                <tr key={a.id} className="border-b border-black/5 align-top last:border-0 hover:bg-brand-soft/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/atributos/${a.id}`} className="font-semibold text-brand-ink hover:text-brand-pink-dark hover:underline">{a.name}</Link>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <Link href={`/admin/atributos/${a.id}`} className="font-medium text-brand-pink-dark hover:underline">Configurar valores</Link>
                      <DeleteAttributeButton id={a.id} name={a.name} products={a._count.products} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    {a.terms.map((t) => t.name).join(", ")}
                    {a._count.terms > a.terms.length && <span className="text-brand-muted/70"> … y {a._count.terms - a.terms.length} más</span>}
                    {a._count.terms === 0 && "—"}
                    <span className="mt-0.5 block text-xs text-brand-muted/70">{a._count.terms} valor{a._count.terms === 1 ? "" : "es"}</span>
                  </td>
                  <td className="px-4 py-3 text-brand-ink">{a._count.products}</td>
                </tr>
              ))}
              {attributes.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">{q ? "Ningún atributo coincide." : "Todavía no hay atributos. Creá el primero a la izquierda."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
