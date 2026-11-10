import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { getStoreSettings } from "@/lib/points";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { Badge } from "@/components/admin/Badge";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { SectionSidebar } from "@/components/admin/SectionSidebar";
import { GearIcon, StarIcon, PlusIcon, ClockIcon } from "@/components/icons";
import { updatePointsSettings, createReward, updateReward, deleteReward } from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export default async function AdminPuntosPage() {
  const { currency } = await getStoreSettingsRow();
  const fm = (n: number) => formatMoneyWith(n, currency);
  const [settings, rewards, redemptions] = await Promise.all([
    getStoreSettings(),
    prisma.pointReward.findMany({ orderBy: { pointsRequired: "asc" } }),
    prisma.pointTransaction.findMany({
      where: { amount: { lt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  // --- Tab: Configuración (ratio de puntos) ---
  const settingsPanel = (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <form action={updatePointsSettings} className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 pb-0.5">
            <ToggleSwitch name="pointsEnabled" defaultChecked={settings.pointsEnabled} />
            <span className="text-sm text-brand-ink">Sistema de puntos activo</span>
          </div>
          <div className="w-52">
            <label className={labelClasses}>Puntos cada $1.000 gastados</label>
            <input
              type="number"
              name="pointsPerThousand"
              min={0}
              step={0.1}
              defaultValue={settings.pointsRatio * 1000}
              className={fieldClasses}
            />
          </div>
        </div>
        <SaveButton trackDirty />
      </form>
      <p className="mt-3 text-xs text-brand-muted">
        Por cada $1.000 de subtotal, un cliente gana {Math.floor(1000 * settings.pointsRatio)} puntos.
      </p>
    </div>
  );

  // --- Tab: Recompensas (catálogo existente) ---
  const rewardsPanel = (
    <div className="flex flex-col gap-4">
      {rewards.map((r) => (
        <form
          key={r.id}
          action={updateReward}
          className={`rounded-xl border bg-white p-5 transition-colors ${
            r.enabled ? "border-brand-pink/30" : "border-black/10"
          }`}
        >
          <input type="hidden" name="id" value={r.id} />
          <CardAccordion
            titleArea={
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    name="title"
                    defaultValue={r.title}
                    required
                    className="min-w-0 flex-1 border-0 p-0 text-base font-semibold text-brand-ink focus:outline-none"
                  />
                  <Badge tone="pink">{r.pointsRequired} pts</Badge>
                </div>
                <p className="mt-1 text-sm text-brand-muted">
                  {r.discountType === "percentage" ? `${r.discountValue}% off` : `${fm(r.discountValue)} off`}
                </p>
              </div>
            }
            headerRight={<ToggleSwitch name="enabled" defaultChecked={r.enabled} />}
          >
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-40">
                <label className={labelClasses}>Puntos requeridos</label>
                <input
                  type="number"
                  name="pointsRequired"
                  min={1}
                  defaultValue={r.pointsRequired}
                  className={fieldClasses}
                />
              </div>
              <div className="w-32">
                <label className={labelClasses}>Tipo</label>
                <select name="discountType" defaultValue={r.discountType} className={`${fieldClasses} bg-white`}>
                  <option value="percentage">% off</option>
                  <option value="fixed">$ off</option>
                </select>
              </div>
              <div className="w-28">
                <label className={labelClasses}>Valor</label>
                <input
                  type="number"
                  name="discountValue"
                  min={0}
                  step={0.01}
                  defaultValue={r.discountValue}
                  className={fieldClasses}
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
              <SaveButton trackDirty />
              <button
                type="submit"
                formAction={deleteReward.bind(null, r.id)}
                className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
              >
                Eliminar
              </button>
            </div>
          </CardAccordion>
        </form>
      ))}

      {rewards.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
          Todavía no creaste ninguna recompensa.
        </p>
      )}
    </div>
  );

  // --- Tab: Nueva recompensa ---
  const newRewardPanel = (
    <form action={createReward} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
      <p className="mb-3 font-semibold text-brand-ink">Nueva recompensa</p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <label className={labelClasses}>Título</label>
          <input type="text" name="title" required placeholder="10% de descuento" className={fieldClasses} />
        </div>
        <div className="w-40">
          <label className={labelClasses}>Puntos requeridos</label>
          <input type="number" name="pointsRequired" min={1} required defaultValue={100} className={fieldClasses} />
        </div>
        <div className="w-32">
          <label className={labelClasses}>Tipo</label>
          <select name="discountType" defaultValue="percentage" className={`${fieldClasses} bg-white`}>
            <option value="percentage">% off</option>
            <option value="fixed">$ off</option>
          </select>
        </div>
        <div className="w-28">
          <label className={labelClasses}>Valor</label>
          <input type="number" name="discountValue" min={0} step={0.01} required className={fieldClasses} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4 border-t border-black/5 pt-4">
        <div className="flex items-center gap-2">
          <ToggleSwitch name="enabled" defaultChecked />
          <span className="text-sm text-brand-ink">Habilitado</span>
        </div>
        <SaveButton label="Crear" />
      </div>
    </form>
  );

  // --- Tab: Últimos canjes ---
  const redemptionsPanel = (
    <div className="overflow-auto rounded-xl border border-black/10 bg-white">
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-brand-muted">
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Detalle</th>
            <th className="px-4 py-3 font-semibold">Puntos</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((tx) => (
            <tr key={tx.id} className="border-b border-black/5 last:border-0">
              <td className="px-4 py-3 font-medium text-brand-ink">{tx.user.name ?? tx.user.email}</td>
              <td className="px-4 py-3 text-brand-muted">{tx.description}</td>
              <td className="px-4 py-3 text-red-700">{tx.amount}</td>
              <td className="px-4 py-3 text-brand-muted">{tx.createdAt.toLocaleDateString("es-AR")}</td>
            </tr>
          ))}
          {redemptions.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-brand-muted">
                Todavía no hubo canjes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Puntos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Los clientes ganan puntos cuando su pedido se marca como entregado, y los canjean por cupones de descuento
          de un solo uso. La acreditación manual está en Configuración → General.
        </p>
      </div>

      <SectionSidebar
        tabs={[
          { id: "config", label: "Configuración", icon: <GearIcon className="h-4 w-4 shrink-0" />, content: settingsPanel },
          {
            id: "recompensas",
            label: "Recompensas",
            icon: <StarIcon className="h-4 w-4 shrink-0" />,
            badge: rewards.length > 0 ? String(rewards.length) : undefined,
            content: rewardsPanel,
          },
          { id: "nueva", label: "Nueva recompensa", icon: <PlusIcon className="h-4 w-4 shrink-0" />, content: newRewardPanel },
          {
            id: "canjes",
            label: "Últimos canjes",
            icon: <ClockIcon className="h-4 w-4 shrink-0" />,
            badge: redemptions.length > 0 ? String(redemptions.length) : undefined,
            content: redemptionsPanel,
          },
        ]}
      />
    </div>
  );
}
