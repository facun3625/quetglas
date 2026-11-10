import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WhatsAppIcon } from "@/components/icons";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { ConversationActions } from "../ConversationActions";

export default async function AdminConversacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await prisma.aiConversation.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } }, messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  // Nombres de los productos que la vendedora recomendó, para mostrarlos con su enlace
  const productIds = [...new Set(conversation.messages.flatMap((m) => m.productIds))];
  const products = productIds.length ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, slug: true } }) : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const who = conversation.name ?? conversation.user?.name ?? "Anónimo";
  const canWhatsApp = conversation.phone && isLikelyPhone(conversation.phone);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <Link href="/admin/conversaciones" className="shrink-0 text-xs font-semibold text-brand-pink-dark hover:underline">← Conversaciones</Link>
      <div className="mt-2 flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">{who}</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Empezó el {conversation.createdAt.toLocaleString("es-AR")} · última actividad {conversation.lastMessageAt.toLocaleString("es-AR")} ·{" "}
            {conversation.messages.length} mensajes
          </p>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-brand-muted">Nombre:</dt><dd className="text-brand-ink">{conversation.name ?? "No lo dejó"}</dd></div>
            <div className="flex gap-2"><dt className="text-brand-muted">Teléfono:</dt><dd className="text-brand-ink">{conversation.phone ?? "No lo dejó"}</dd></div>
            {conversation.user && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-brand-muted">Cuenta:</dt>
                <dd className="text-brand-ink"><Link href={`/admin/usuarios/${conversation.user.id}`} className="hover:underline">{conversation.user.name ?? conversation.user.email}</Link> · {conversation.user.email}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          {canWhatsApp && (
            <a
              href={buildWhatsAppLink(conversation.phone!, `Hola ${conversation.name ?? ""}! Te escribimos de la tienda por la consulta que hiciste en el chat.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Escribirle por WhatsApp
            </a>
          )}
          <ConversationActions id={conversation.id} handled={Boolean(conversation.handledAt)} />
          {conversation.handledAt && <p className="text-xs text-brand-muted">Atendida el {conversation.handledAt.toLocaleString("es-AR")}</p>}
        </div>
      </div>

      <div className="mt-6 flex max-w-3xl flex-col gap-3 pb-8">
        {conversation.messages.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">Dejó sus datos pero todavía no escribió ninguna consulta.</p>}
        {conversation.messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "ml-10" : "mr-10"}>
            <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-brand-pink text-white" : "rounded-bl-sm border border-black/10 bg-white text-brand-ink"}`}>
              {m.content}
            </div>
            {m.productIds.length > 0 && (
              <p className="mt-1.5 text-xs text-brand-muted">
                Productos recomendados:{" "}
                {m.productIds.map((pid, i) => {
                  const p = byId.get(pid);
                  return (
                    <span key={pid}>
                      {i > 0 && ", "}
                      {p ? <Link href={`/producto/${p.slug}`} target="_blank" className="font-medium text-brand-pink-dark hover:underline">{p.name}</Link> : "un producto que ya no existe"}
                    </span>
                  );
                })}
              </p>
            )}
            <p className={`mt-1 text-[11px] text-brand-muted ${m.role === "user" ? "text-right" : ""}`}>{m.role === "user" ? "Cliente" : "Vendedora"} · {m.createdAt.toLocaleString("es-AR")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
