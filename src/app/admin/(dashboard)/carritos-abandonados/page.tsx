import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { Badge } from "@/components/admin/Badge";
import { WhatsAppSendLink } from "@/components/admin/WhatsAppSendLink";
import { WhatsAppSentCell } from "@/components/admin/WhatsAppSentCell";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/siteUrl";
import { CopyEmailsButton } from "./CopyEmailsButton";
import { UserTypeFilter } from "./UserTypeFilter";
import { deleteAbandonedCart, cleanupOldAbandonedCarts, markCartWhatsApp } from "./actions";
import { CartRecoveryPanel } from "./CartRecoveryPanel";
import { getMailSender } from "@/lib/mailer";
import { getUsageStatus } from "@/lib/usage";
import { DEFAULT_MESSAGE, DEFAULT_SUBJECT } from "@/lib/cartRecoveryMail";

import { storeNameOf } from "@/lib/storeName";
type CartItemJson = { productId: string | null; name: string; price: number; quantity: number };

type UserType = "all" | "registered" | "guest" | "anonymous";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 3600_000);
}

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default async function AdminCarritosAbandonadosPage({
  searchParams,
}: {
  searchParams: Promise<{ userType?: string }>;
}) {
  const params = await searchParams;
  const settings = await getStoreSettingsRow();
  const { currency } = settings;
  const [mailSender, usage, sentLast7Days] = await Promise.all([
    getMailSender(),
    getUsageStatus(),
    prisma.abandonedCart.count({ where: { recoveryEmailSentAt: { gte: daysAgo(7) } } }),
  ]);
  const fm = (n: number) => formatMoneyWith(n, currency);
  const userType: UserType =
    params.userType === "registered" || params.userType === "guest" || params.userType === "anonymous"
      ? params.userType
      : "all";

  const carts = await prisma.abandonedCart.findMany({
    where: {
      ...(userType === "registered" && { userId: { not: null } }),
      ...(userType === "guest" && { userId: null, email: { not: null } }),
      ...(userType === "anonymous" && { userId: null, email: null }),
    },
    orderBy: { lastActive: "desc" },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });

  // El link del mensaje de WhatsApp vuelve a cargar los productos en el carrito de quien lo abre
  const base = siteUrl();

  const emails = carts.map((c) => c.user?.email ?? c.email).filter((e): e is string => Boolean(e));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Carritos abandonados</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {carts.length} carritos con productos sin comprar. Es una foto del último estado de cada carrito: podés contactar
          a mano a quien no terminó la compra o dejar que se les mande un mail automático.
        </p>

        <CartRecoveryPanel
          initial={{ enabled: settings.cartRecoveryEnabled, delayHours: settings.cartRecoveryDelayHours, subject: settings.cartRecoverySubject ?? "", message: settings.cartRecoveryMessage ?? "" }}
          mailReady={mailSender !== null}
          sentLast7Days={sentLast7Days}
          mailQuotaExhausted={usage.mail.exhausted}
          defaults={{ subject: DEFAULT_SUBJECT, message: DEFAULT_MESSAGE }}
        />

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <UserTypeFilter defaultValue={userType} />

          <CopyEmailsButton emails={emails} />

          <form action={cleanupOldAbandonedCarts}>
            <button
              type="submit"
              title="Borra los que no tienen actividad hace más de 30 días"
              className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
            >
              Limpiar viejos (+30 días)
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Items</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Última actividad</th>
              <th className="px-4 py-3 font-semibold">Mail automático</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {carts.map((cart) => {
              const items = (cart.items as unknown as CartItemJson[]) ?? [];
              const email = cart.user?.email ?? cart.email;
              const label = cart.user?.name ?? cart.name ?? email ?? cart.phone ?? "Anónimo";
              const type = cart.userId ? "registered" : email || cart.phone ? "guest" : "anonymous";
              // El teléfono del carrito en sí solo se carga si llegaron a
              // escribirlo en el formulario de checkout (la mayoría de los
              // abandonos pasan antes de eso) — para un usuario registrado
              // caemos al que quedó guardado en su cuenta (ver
              // saveUserPhone), cargado la última vez que compró.
              const phoneFromAccount = !cart.phone ? cart.user?.phone ?? undefined : undefined;
              const phone = cart.phone ?? phoneFromAccount;

              return (
                <tr key={cart.id} className="border-b border-black/5 last:border-0 hover:bg-brand-soft/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-ink">{label}</p>
                    {email && <p className="text-xs text-brand-muted">{email}</p>}
                    {phone && (
                      <p className="text-xs text-brand-muted">
                        {phone}
                        {phoneFromAccount && " (de la cuenta)"}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={type === "registered" ? "pink" : type === "guest" ? "neutral" : "amber"}>
                      {type === "registered" ? "Registrado" : type === "guest" ? "Invitado" : "Anónimo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    {items.length} {items.length === 1 ? "producto" : "productos"}
                  </td>
                  <td className="px-4 py-3 text-brand-pink-dark">{fm(cart.total)}</td>
                  <td className="px-4 py-3 text-brand-muted">{timeAgo(cart.lastActive)}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{cart.recoveryEmailSentAt ? `Enviado ${timeAgo(cart.recoveryEmailSentAt)}` : "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    <WhatsAppSentCell date={cart.whatsappSentAt} count={cart.whatsappCount} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      {phone && isLikelyPhone(phone) && (
                        <WhatsAppSendLink
                          sent={Boolean(cart.whatsappSentAt)}
                          onSent={markCartWhatsApp.bind(null, cart.id)}
                          href={buildWhatsAppLink(
                            phone,
                            `Hola ${cart.user?.name ?? cart.name ?? ""}! Vimos que dejaste ${items.length === 1 ? items[0]?.name ?? "un producto" : `${items.length} productos`} en tu carrito de ${storeNameOf(settings)}. ¿Te ayudamos a completar la compra? ${base}/carrito?recuperar=${cart.id}&utm_source=whatsapp&utm_medium=mensaje&utm_campaign=recuperar-carrito`
                          )}
                        />
                      )}
                      <form action={deleteAbandonedCart.bind(null, cart.id)}>
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
              );
            })}
            {carts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-brand-muted">
                  No hay carritos abandonados por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
