import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/admin/Badge";
import { LiveSearch } from "@/components/admin/LiveSearch";
import { WhatsAppIcon } from "@/components/icons";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";

const PAGE_SIZE = 25;
type Filter = "all" | "contact" | "phone" | "handled";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "contact", label: "Para contactar" },
  { id: "phone", label: "Con teléfono" },
  { id: "handled", label: "Atendidas" },
];

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

const filterWhere = (f: Filter): Prisma.AiConversationWhereInput =>
  f === "contact" ? { phone: { not: null }, handledAt: null } : f === "phone" ? { phone: { not: null } } : f === "handled" ? { handledAt: { not: null } } : {};

export default async function AdminConversacionesPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; page?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const filter: Filter = (["contact", "phone", "handled"] as const).find((f) => f === params.f) ?? "all";
  const page = Math.max(1, Number(params.page) || 1);

  const search: Prisma.AiConversationWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { user: { email: { contains: q, mode: "insensitive" } } },
          { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};
  const where: Prisma.AiConversationWhereInput = { AND: [search, filterWhere(filter)] };

  const [rows, total, counts] = await Promise.all([
    prisma.aiConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true, name: true, phone: true, handledAt: true, lastMessageAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 1, where: { role: "user" }, select: { content: true } },
      },
    }),
    prisma.aiConversation.count({ where }),
    Promise.all(FILTERS.map((f) => prisma.aiConversation.count({ where: filterWhere(f.id) }))),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(Object.entries({ q: q || undefined, f: filter === "all" ? undefined : filter, ...over }).filter(([, v]) => v) as [string, string][]);
    const qs = sp.toString();
    return `/admin/conversaciones${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Conversaciones con la vendedora IA</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Cada conversación del chat queda guardada acá, con el nombre y el teléfono que dejó el cliente al empezar. Si la IA no resolvió su consulta,
          podés contactarlo por WhatsApp.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LiveSearch defaultValue={q} placeholder="Buscar por nombre, teléfono o texto…" />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f, i) => (
              <Link
                key={f.id}
                href={href({ f: f.id === "all" ? undefined : f.id, page: undefined })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${filter === f.id ? "border-brand-pink bg-brand-pink text-white" : "border-black/10 text-brand-ink hover:bg-brand-soft"}`}
              >
                {f.label} <span className="opacity-70">{counts[i]}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Teléfono</th>
              <th className="px-4 py-3 font-semibold">Primera consulta</th>
              <th className="px-4 py-3 font-semibold">Mensajes</th>
              <th className="px-4 py-3 font-semibold">Última actividad</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const who = c.name ?? c.user?.name ?? "Anónimo";
              return (
                <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/conversaciones/${c.id}`} className="font-medium text-brand-ink hover:text-brand-pink-dark hover:underline">{who}</Link>
                    {c.user?.email && <span className="block text-xs text-brand-muted">{c.user.email}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      isLikelyPhone(c.phone) ? (
                        <a href={buildWhatsAppLink(c.phone, `Hola ${c.name ?? ""}! Te escribimos de la tienda por la consulta que hiciste en el chat.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline">
                          <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
                          {c.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-brand-muted">{c.phone}</span>
                      )
                    ) : (
                      <span className="text-xs text-brand-muted">—</span>
                    )}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-brand-muted">{c.messages[0]?.content ?? "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{c._count.messages}</td>
                  <td className="px-4 py-3 text-brand-muted">{timeAgo(c.lastMessageAt)}</td>
                  <td className="px-4 py-3">
                    {c.handledAt ? <Badge tone="green">Atendida</Badge> : c.phone ? <Badge tone="amber">Para contactar</Badge> : <span className="text-xs text-brand-muted">Sin contacto</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/conversaciones/${c.id}`} className="text-xs font-semibold text-brand-pink-dark hover:underline">Ver →</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-brand-muted">{q || filter !== "all" ? "Ninguna conversación coincide." : "Todavía no hubo conversaciones con la vendedora."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex shrink-0 items-center justify-between text-sm text-brand-muted">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={href({ page: String(page - 1) })} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">← Anterior</Link>}
            {page < totalPages && <Link href={href({ page: String(page + 1) })} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-soft">Siguiente →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
