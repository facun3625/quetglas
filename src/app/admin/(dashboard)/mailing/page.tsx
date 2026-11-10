import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getAudienceCounts, getSegmentCounts, AUDIENCE_LABELS } from "@/lib/audiences";
import { ensureSegmentsSeeded } from "@/lib/customers";
import { getMailQuotaStatus } from "@/lib/mailQuota";
import { Badge } from "@/components/admin/Badge";
import { SendIcon, MailIcon, TrendUpIcon } from "@/components/icons";
import { MailComposer } from "./MailComposer";
import { resolveLogos } from "@/lib/logo";
import { MailHistoryPoller } from "./MailHistoryPoller";
import { SectionSidebar } from "@/components/admin/SectionSidebar";
import { deleteCampaign } from "./actions";

import { storeNameOf } from "@/lib/storeName";
const STATUS_LABELS: Record<string, string> = {
  sending: "Enviando...",
  done: "Enviado",
  failed: "Falló (revisá el SMTP)",
};

const STATUS_TONES: Record<string, "amber" | "green" | "red"> = {
  sending: "amber",
  done: "green",
  failed: "red",
};


export default async function AdminMailingPage() {
  await ensureSegmentsSeeded();
  const [settings, audienceCounts, segmentCounts, campaigns, quota] = await Promise.all([
    getStoreSettingsRow(),
    getAudienceCounts(),
    getSegmentCounts(),
    prisma.mailCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    getMailQuotaStatus(),
  ]);

  const smtpReady = Boolean(settings.smtpHost && settings.smtpUser && settings.smtpPassword && settings.mailFromEmail);
  const hasSending = campaigns.some((c) => c.status === "sending");

  // --- Tab: Mail (armar y mandar) ---
  const mailPanel = (
    <div>
      {!smtpReady && (
        <div className="mb-4 shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Todavía falta completar el SMTP en <span className="font-semibold">Configuración → Franquicia y mailing</span>.
          Podés armar el mail igual, pero el envío va a fallar hasta que lo cargues.
        </div>
      )}
      <MailComposer
        audienceCounts={audienceCounts}
        segmentCounts={segmentCounts}
        franchiseName={storeNameOf(settings)}
        franchiseLocation={settings.franchiseLocation}
        logoUrl={resolveLogos(settings).header}
        quotaRemaining={quota.remaining}
        footer={{
          address: settings.address,
          whatsappNumber: settings.whatsappPhone,
          instagramHandle: settings.instagramHandle,
          contactEmail: settings.mailFromEmail,
        }}
      />
    </div>
  );

  // --- Tab: Campañas enviadas (historial, ya existía debajo del compositor) ---
  const campaignsPanel = (
    <div className="overflow-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
            <th className="px-4 py-3 font-semibold">Asunto</th>
            <th className="px-4 py-3 font-semibold">Listas</th>
            <th className="px-4 py-3 font-semibold">Destinatarios</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
              <td className="px-4 py-3 font-medium text-brand-ink">
                {c.subject}
                <p className="text-xs font-normal text-brand-muted">{c.title}</p>
              </td>
              <td className="px-4 py-3 text-brand-muted">{[...c.audiences.map((a) => AUDIENCE_LABELS[a]), ...(c.segmentIds.length ? [`${c.segmentIds.length} segmento(s)`] : [])].join(", ")}</td>
              <td className="px-4 py-3 text-brand-muted">
                {c.sentCount} / {c.recipientCount}
              </td>
              <td className="px-4 py-3">
                <Badge tone={STATUS_TONES[c.status]}>{STATUS_LABELS[c.status]}</Badge>
              </td>
              <td className="px-4 py-3 text-brand-muted">{c.createdAt.toLocaleString("es-AR")}</td>
              <td className="px-4 py-3 text-right">
                <form action={deleteCampaign.bind(null, c.id)}>
                  <button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700">
                    Eliminar
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {campaigns.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                Todavía no mandaste ningún mailing.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // --- Tab: Disponibilidad (cupo mensual) ---
  const usedPct = quota.quota ? Math.min(100, (quota.used / quota.quota) * 100) : 0;
  const overQuota = quota.quota != null && quota.used > quota.quota;
  const currentMonthName = new Date().toLocaleDateString("es-AR", { month: "long" });
  const disponibilidadPanel = (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Cupo del mes</p>
        <p className="mt-0.5 text-xs text-brand-muted">
          Mails enviados desde el 1 de {currentMonthName}: se reinicia el{" "}
          {quota.resetsOn.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}.
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <p className="text-2xl font-bold text-brand-ink">
            {quota.used}
            {quota.quota != null && <span className="text-base font-medium text-brand-muted"> / {quota.quota}</span>}
          </p>
          {quota.quota != null && (
            <p className={`text-xs font-medium ${overQuota ? "text-red-700" : "text-brand-muted"}`}>
              {overQuota ? `Te pasaste por ${quota.used - quota.quota}` : `Quedan ${quota.remaining}`}
            </p>
          )}
        </div>

        {quota.quota != null && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-soft">
            <div
              className={`h-2 rounded-full transition-all ${overQuota ? "bg-red-500" : "bg-brand-pink"}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        )}

        <p className="mt-5 border-t border-black/5 pt-4 text-xs text-brand-muted">
          El cupo se define en{" "}
          <Link href="/admin/configuracion" className="font-semibold text-brand-pink-dark hover:underline">Configuración → Consumo</Link>.
          Cuenta todos los mails que salen (campañas, avisos de compra, recuperación de carritos y contraseñas). Al agotarse se frenan las
          campañas y los mails automáticos; los de compra y de contraseña salen siempre.
        </p>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Campañas de este mes</p>
        {quota.campaignsThisMonth.length === 0 ? (
          <p className="mt-3 text-sm text-brand-muted">Todavía no mandaste ninguna este mes.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {quota.campaignsThisMonth.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-brand-ink">{c.subject}</span>
                <span className="shrink-0 text-brand-muted">{c.sentCount} mails</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <MailHistoryPoller active={hasSending} />

      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Mailing</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Armá un mail y mandalo a una o varias listas. Se envía en segundo plano, no hace falta esperar en esta
          pantalla.
        </p>
      </div>

      <SectionSidebar
        tabs={[
          { id: "mail", label: "Mail", icon: <SendIcon className="h-4 w-4 shrink-0" />, content: mailPanel },
          {
            id: "campanas",
            label: "Campañas enviadas",
            icon: <MailIcon className="h-4 w-4 shrink-0" />,
            badge: campaigns.length > 0 ? String(campaigns.length) : undefined,
            content: campaignsPanel,
          },
          {
            id: "disponibilidad",
            label: "Disponibilidad",
            icon: <TrendUpIcon className="h-4 w-4 shrink-0" />,
            badge: overQuota ? "!" : undefined,
            content: disponibilidadPanel,
          },
        ]}
      />
    </div>
  );
}
