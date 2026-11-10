import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensurePagesSeeded } from "@/lib/pages";

export default async function AdminPaginasPage() {
  await ensurePagesSeeded();
  const pages = await prisma.page.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Páginas</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Quiénes somos, contacto y textos legales. Las que activás aparecen en el pie de la tienda. Las legales vienen
            desactivadas con un texto de ejemplo: completalas y activalas.
          </p>
        </div>
        <Link href="/admin/paginas/nueva" className="rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink-dark">
          + Nueva página
        </Link>
      </div>
      <div className="mt-6 divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
        {pages.map((p) => (
          <Link key={p.id} href={`/admin/paginas/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-soft/50">
            <span>
              <span className="font-medium text-brand-ink">{p.title}</span>
              <span className="block text-xs text-brand-muted">/pagina/{p.slug}</span>
            </span>
            <span className="flex items-center gap-2 text-xs">
              {p.showContactForm && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-ink">Formulario</span>}
              <span className={`rounded-full px-2.5 py-1 font-semibold ${p.enabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {p.enabled ? "Publicada" : "Oculta"}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
