import { getAdminLogsPage, adminActionLabel } from "@/lib/adminLog";
import { auth } from "@/lib/auth";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 40;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const session = await auth();
  const { logs, total } = await getAdminLogsPage({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, hideSuperAdmin: session?.user?.role !== "superadmin" });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Registro</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Todo lo que hace el equipo desde el panel queda registrado acá.
        </p>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">Admin</th>
              <th className="px-4 py-3 font-semibold">Acción</th>
              <th className="px-4 py-3 font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="whitespace-nowrap px-4 py-3 text-brand-muted">
                  {log.createdAt.toLocaleString("es-AR")}
                </td>
                <td className="px-4 py-3 text-brand-ink">{log.adminEmail}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
                    {adminActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 text-brand-muted">{log.detail ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay registros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0">
        <Pagination basePath="/admin/logs" currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
