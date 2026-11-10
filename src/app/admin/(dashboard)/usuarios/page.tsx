import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/roles";
import { getCustomerRows, getSegmentMembers, ensureSegmentsSeeded } from "@/lib/customers";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { setUserRole, deleteUser } from "./actions";
import { UserSearchInput } from "./UserSearchInput";
import { SegmentFilter } from "./SegmentFilter";
import { NewAdminForm } from "./NewAdminForm";
import { ResetPasswordButton } from "./ResetPasswordButton";

type Sort = "recent" | "spent" | "orders" | "last";

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string; sort?: string; role?: string }>;
}) {
  const { q, segment: segmentId, sort: sortParam, role: roleParam } = await searchParams;
  // Dos vistas de la misma lista (las dos entradas del menú): solo clientes o solo administradores; sin filtro, todas las cuentas
  const view = roleParam === "clientes" || roleParam === "administradores" ? roleParam : null;
  const query = q?.trim().toLowerCase() ?? "";
  const sort: Sort = (["recent", "spent", "orders", "last"] as const).includes(sortParam as Sort) ? (sortParam as Sort) : "recent";
  await ensureSegmentsSeeded();
  const session = await auth();
  const viewerRole = session?.user?.role;
  const [{ currency }, segments, rows] = await Promise.all([
    getStoreSettingsRow(),
    prisma.customerSegment.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getCustomerRows({ includeAdmins: true, includeSuperAdmin: isSuperAdmin(viewerRole) }),
  ]);
  const segment = segments.find((s) => s.id === segmentId);

  let users = segment && view !== "administradores" ? await getSegmentMembers(segment, rows) : rows;
  if (view === "clientes") users = users.filter((u) => u.role === "customer");
  if (view === "administradores") users = users.filter((u) => u.role !== "customer");
  if (query) users = users.filter((u) => u.email.toLowerCase().includes(query) || (u.name ?? "").toLowerCase().includes(query));
  users = [...users].sort((a, b) => {
    if (sort === "spent") return b.stats.spent - a.stats.spent;
    if (sort === "orders") return b.stats.orders - a.stats.orders;
    if (sort === "last") return (b.stats.lastOrderAt?.getTime() ?? 0) - (a.stats.lastOrderAt?.getTime() ?? 0);
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const fm = (n: number) => formatMoneyWith(n, currency);
  const sortHref = (s: Sort) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (segmentId) sp.set("segment", segmentId);
    if (view) sp.set("role", view);
    sp.set("sort", s);
    return `/admin/usuarios?${sp.toString()}`;
  };
  const exportHref = `/api/admin/customers/export?${new URLSearchParams({ ...(q ? { q } : {}), ...(segmentId ? { segment: segmentId } : {}) }).toString()}`;
  const th = "px-4 py-3 font-semibold";
  const sortLink = (s: Sort, text: string) => (
    <Link href={sortHref(s)} className={`hover:text-brand-pink-dark ${sort === s ? "text-brand-pink-dark" : ""}`}>{text}{sort === s ? " ↓" : ""}</Link>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{view === "clientes" ? "Clientes" : view === "administradores" ? "Administradores" : "Clientes y usuarios"}</h1>
          <p className="mt-1 text-sm text-brand-muted">
            {users.length} {view === "administradores" ? "cuentas con acceso al panel" : segment ? `en el segmento “${segment.name}”` : view === "clientes" ? "clientes registrados" : "cuentas registradas"}.{" "}
            <Link href="/admin/segmentos" className="font-medium text-brand-pink-dark hover:underline">Administrar segmentos</Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view !== "administradores" && <SegmentFilter segments={segments.map((s) => ({ id: s.id, name: s.name }))} current={segmentId ?? ""} />}
          <UserSearchInput defaultValue={q?.trim() ?? ""} />
          {view !== "clientes" && <NewAdminForm />}
          <a href={exportHref} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold text-brand-ink hover:bg-brand-soft">Exportar CSV</a>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className={th}>Cliente</th>
              {view !== "clientes" && <th className={th}>Rol</th>}
              <th className={th}>{sortLink("recent", "Alta")}</th>
              <th className={th}>{sortLink("orders", "Compras")}</th>
              <th className={th}>{sortLink("spent", "Gasto total")}</th>
              <th className={th}>{sortLink("last", "Última compra")}</th>
              <th className={th}>Puntos</th>
              <th className={th} />
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === session?.user?.id;
              return (
                <tr key={u.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/usuarios/${u.id}`} className="font-medium text-brand-ink hover:text-brand-pink-dark hover:underline">{u.name ?? "—"}</Link>
                    <span className="block text-xs text-brand-muted">{u.email}</span>
                  </td>
                  {view !== "clientes" && (
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.role !== "customer" ? "bg-brand-pink/10 text-brand-pink-dark" : "bg-gray-100 text-gray-700"}`}>
                        {u.role === "superadmin" ? "Superadministrador" : u.role === "admin" ? "Administrador" : u.role === "couponStaff" ? "Cupón rápido" : "Cliente"}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-brand-muted">{u.createdAt.toLocaleDateString("es-AR")}</td>
                  <td className="px-4 py-3 text-brand-ink">{u.stats.orders}</td>
                  <td className="px-4 py-3 text-brand-ink">{u.stats.orders > 0 ? fm(u.stats.spent) : "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{u.stats.lastOrderAt ? u.stats.lastOrderAt.toLocaleDateString("es-AR") : "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{u.points}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                    {isSuperAdmin(viewerRole) && u.role !== "superadmin" && <ResetPasswordButton userId={u.id} email={u.email} />}
                    {u.role === "superadmin" ? null : u.role === "admin" ? (
                      <form action={setUserRole.bind(null, u.id, "customer")}>
                        <button type="submit" disabled={isSelf} className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40" title={isSelf ? "No podés quitarte el rol a vos mismo" : undefined}>Quitar admin</button>
                      </form>
                    ) : u.role === "couponStaff" ? (
                      <form action={setUserRole.bind(null, u.id, "customer")}>
                        <button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700">Quitar acceso</button>
                      </form>
                    ) : (
                      <form action={setUserRole.bind(null, u.id, "admin")}>
                        <button type="submit" className="cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline">Hacer admin</button>
                      </form>
                    )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteUser.bind(null, u.id)} hidden={u.role === "superadmin"}>
                      <button type="submit" disabled={isSelf} className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40" title={isSelf ? "No podés eliminar tu propia cuenta" : undefined}>Eliminar</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={view === "clientes" ? 8 : 9} className="px-4 py-8 text-center text-brand-muted">{query || segment ? "Ningún usuario coincide." : "Todavía no hay usuarios registrados."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
