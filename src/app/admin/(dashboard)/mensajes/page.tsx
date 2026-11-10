import { prisma } from "@/lib/prisma";
import { MessageActions } from "./MessageActions";

export const dynamic = "force-dynamic";

export default async function AdminMensajesPage() {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const unread = messages.filter((m) => !m.read).length;
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-ink">Mensajes de contacto</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Lo que los clientes escriben desde el formulario de la página de contacto. {unread > 0 ? `${unread} sin leer.` : "No hay mensajes sin leer."}
      </p>
      <div className="mt-6 space-y-3">
        {messages.map((m) => (
          <article key={m.id} className={`rounded-xl border bg-white p-4 ${m.read ? "border-black/10" : "border-brand-pink/40"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-brand-ink">
                {m.name} <span className="font-normal text-brand-muted">· {m.email}{m.phone ? ` · ${m.phone}` : ""}</span>
              </p>
              <span className="text-xs text-brand-muted">{m.createdAt.toLocaleString("es-AR")}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink/90">{m.message}</p>
            <MessageActions id={m.id} read={m.read} email={m.email} />
          </article>
        ))}
        {messages.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-brand-muted">Todavía no llegaron mensajes.</p>}
      </div>
    </div>
  );
}
