import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/admin/Badge";
import { StatCard } from "@/components/admin/StatCard";
import { BellRingIcon, UsersIcon } from "@/components/icons";
import { PushHistoryPoller } from "./PushHistoryPoller";
import { sendPushBroadcast, deletePushCampaign } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  sending: "Enviando...",
  done: "Enviado",
  failed: "Falló",
};

const STATUS_TONES: Record<string, "amber" | "green" | "red"> = {
  sending: "amber",
  done: "green",
  failed: "red",
};

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export default async function AdminNotificacionesPage() {
  const [subscriberCount, registeredCount, campaigns] = await Promise.all([
    prisma.pushSubscription.count(),
    prisma.pushSubscription.count({ where: { userId: { not: null } } }),
    prisma.pushCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const hasSending = campaigns.some((c) => c.status === "sending");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <PushHistoryPoller active={hasSending} />

      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Notificaciones push</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Mandá una notificación a todos los que instalaron la Web App y aceptaron el permiso — llega aunque no
          tengan el sitio abierto. Se manda a todos los suscriptos, sin listas.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard icon={BellRingIcon} tone="pink" label="Suscriptos" value={String(subscriberCount)} hint="dispositivos activos" />
        <StatCard icon={UsersIcon} tone="neutral" label="Registrados" value={String(registeredCount)} hint="de esos, con cuenta" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <form action={sendPushBroadcast} className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
          <div>
            <label className={labelClasses}>Título</label>
            <input
              type="text"
              name="title"
              required
              maxLength={80}
              placeholder="Volvió el stock que esperabas ✨"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Mensaje</label>
            <textarea
              name="body"
              required
              rows={4}
              maxLength={200}
              placeholder="Ya podés volver a comprar tu producto favorito."
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Link al tocarla (opcional)</label>
            <input type="text" name="url" placeholder="/tienda" className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Ruta dentro del sitio, ej. /tienda o /categoria/43. Vacío = abre el home.</p>
          </div>

          <div className="flex items-center gap-3 border-t border-black/5 pt-4">
            <button
              type="submit"
              disabled={subscriberCount === 0}
              className="cursor-pointer rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mandar a los {subscriberCount} suscriptos
            </button>
          </div>
          {subscriberCount === 0 && (
            <p className="text-xs text-brand-muted">Todavía nadie instaló la Web App ni activó las notificaciones.</p>
          )}
        </form>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-sm font-semibold text-brand-ink">Historial</p>
          {campaigns.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">Todavía no mandaste ninguna notificación.</p>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-black/5">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-ink">{c.title}</p>
                    <p className="truncate text-xs text-brand-muted">{c.body}</p>
                    <p className="mt-1 text-xs text-brand-muted">
                      {c.sentCount} / {c.recipientCount} · {c.createdAt.toLocaleString("es-AR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={STATUS_TONES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                    <form action={deletePushCampaign.bind(null, c.id)}>
                      <button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
