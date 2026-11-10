import { SaveButton } from "@/components/admin/SaveButton";
import type { UsageLine, UsageStatus } from "@/lib/usage";
import { updateUsageQuotas } from "./actions";

const field = "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const label = "mb-1 block text-xs font-medium text-brand-muted";
const fmt = (n: number) => n.toLocaleString("es-AR");

function Meter({ line, unit }: { line: UsageLine; unit: string }) {
  const color = line.exhausted ? "bg-red-500" : line.warning ? "bg-amber-500" : "bg-brand-pink";
  return (
    <>
      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-2xl font-bold text-brand-ink">
          {fmt(line.used)}
          {line.quota !== null ? <span className="text-base font-medium text-brand-muted"> / {fmt(line.quota)} {unit}</span> : <span className="text-base font-medium text-brand-muted"> {unit}</span>}
        </p>
        <p className={`text-xs font-medium ${line.exhausted ? "text-red-700" : line.warning ? "text-amber-700" : "text-brand-muted"}`}>
          {line.quota === null ? "Sin límite" : line.exhausted ? "Cupo agotado" : `Quedan ${fmt(line.remaining ?? 0)}`}
        </p>
      </div>
      {line.quota !== null && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-soft">
          <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${line.pct}%` }} />
        </div>
      )}
    </>
  );
}

// Consumo del mes de lo que tiene cupo (mails y tokens de la IA). Todos los administradores lo ven; solo el
// superadministrador cambia los cupos.
export function UsagePanel({ status, isSuper }: { status: UsageStatus; isSuper: boolean }) {
  const resets = status.resetsOn.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  const avg = status.aiRequests > 0 ? Math.round(status.ai.used / status.aiRequests) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Consumo del mes</p>
        <p className="mt-1 text-xs text-brand-muted">
          Cada mail que sale y cada respuesta de la vendedora de IA se va restando del cupo. El contador arranca de cero solo el {resets}.
        </p>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Mails</p>
        <Meter line={status.mail} unit="mails" />
        <p className="mt-3 text-xs text-brand-muted">
          Cuenta todos los mails que salen: campañas, avisos de compra y de cambio de estado, recuperación de carritos y contraseñas. Si se agota,
          se frenan las <strong>campañas</strong> y la <strong>recuperación automática de carritos</strong>; los avisos de compra y de contraseña
          siguen saliendo siempre.
        </p>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Vendedora de IA</p>
        <Meter line={status.ai} unit="tokens" />
        <p className="mt-3 text-xs text-brand-muted">
          Los tokens son lo que cobra el proveedor de IA: cuentan lo que se le manda y lo que responde en cada conversación.
          {avg !== null && <> Este mes: {fmt(status.aiRequests)} respuestas, unos {fmt(avg)} tokens cada una.</>}{" "}
          Si se agota, la vendedora se reemplaza por el acceso directo a WhatsApp hasta el mes que viene.
        </p>
      </div>

      <form action={updateUsageQuotas} className="rounded-xl border border-black/10 bg-white p-5">
        <p className="text-sm font-semibold text-brand-ink">Cupos mensuales</p>
        {isSuper ? (
          <>
            <p className="mt-1 text-xs text-brand-muted">Dejá un campo vacío para no poner límite. Se avisa en el inicio del panel al llegar al 80 %.</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div className="w-48">
                <label className={label}>Mails por mes</label>
                <input type="text" inputMode="numeric" name="mailMonthlyQuota" defaultValue={status.mail.quota ?? ""} placeholder="Sin límite" className={field} />
              </div>
              <div className="w-56">
                <label className={label}>Tokens de IA por mes</label>
                <input type="text" inputMode="numeric" name="aiMonthlyTokenQuota" defaultValue={status.ai.quota ?? ""} placeholder="Sin límite" className={field} />
              </div>
              <SaveButton trackDirty />
            </div>
          </>
        ) : (
          <p className="mt-1 text-xs text-brand-muted">Los cupos los define el superadministrador. Si necesitás más, pedíselo a él.</p>
        )}
      </form>
    </div>
  );
}
