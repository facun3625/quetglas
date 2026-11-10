import { prisma } from "@/lib/prisma";
import { WhatsAppSendLink } from "@/components/admin/WhatsAppSendLink";
import { WhatsAppSentCell } from "@/components/admin/WhatsAppSentCell";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { CopyEmailsButton } from "./CopyEmailsButton";
import { deleteWaitlistEntry, markWaitlistWhatsApp } from "./actions";
import { getStoreSettingsRow } from "@/lib/settings";
import { storeNameOf } from "@/lib/storeName";

export default async function AdminListaEsperaPage() {
  const [entries, settings] = await Promise.all([prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } }), getStoreSettingsRow()]);
  const emails = [...new Set(entries.map((e) => e.email))];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Lista de espera</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {entries.length} clientes esperando que vuelva el stock de algún producto. Se anotan solos desde "Avisarme
          cuando haya stock" en la tienda — no se les avisa automático todavía.
        </p>

        <div className="mt-6">
          <CopyEmailsButton emails={emails} />
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Fecha</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                <td className="px-4 py-3 font-medium text-brand-ink">{e.productName}</td>
                <td className="px-4 py-3 text-brand-muted">{e.categoryName ?? "—"}</td>
                <td className="px-4 py-3">
                  <p className="text-brand-ink">{e.name}</p>
                  <p className="text-xs text-brand-muted">
                    {e.email}
                    {e.phone ? ` · ${e.phone}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-brand-muted">{e.createdAt.toLocaleDateString("es-AR")}</td>
                <td className="px-4 py-3 text-xs">
                  <WhatsAppSentCell date={e.whatsappSentAt} count={e.whatsappCount} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {e.phone && isLikelyPhone(e.phone) && (
                      <WhatsAppSendLink
                        sent={Boolean(e.whatsappSentAt)}
                        onSent={markWaitlistWhatsApp.bind(null, e.id)}
                        href={buildWhatsAppLink(
                          e.phone,
                          `Hola ${e.name}! Te escribimos de ${storeNameOf(settings)} porque estabas esperando que vuelva el stock de "${e.productName}" — ¡ya está disponible!`
                        )}
                      />
                    )}
                    <form action={deleteWaitlistEntry.bind(null, e.id)}>
                      <button
                        type="submit"
                        className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-brand-muted">
                  Todavía no hay nadie anotado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
