import { prisma } from "@/lib/prisma";
import { deleteSubscriber } from "./actions";

export default async function AdminSuscriptoresPage() {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Suscriptores</h1>
        <p className="mt-1 text-sm text-brand-muted">{subscribers.length} suscriptos al newsletter.</p>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Suscripto</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{s.email}</td>
                <td className="px-4 py-3 text-brand-muted">{s.createdAt.toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteSubscriber.bind(null, s.id)}>
                    <button
                      type="submit"
                      className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700"
                    >
                      Eliminar
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay suscriptores.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
