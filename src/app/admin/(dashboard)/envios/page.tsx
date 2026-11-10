import { getAllShippingMethods } from "@/lib/shipping";
import { getStoreSettingsRow } from "@/lib/settings";
import { formatMoneyWith } from "@/lib/money";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { ChipCheckbox } from "@/components/admin/ChipCheckbox";
import { Badge } from "@/components/admin/Badge";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import { prisma } from "@/lib/prisma";
import { PROVINCES } from "@/lib/provinces";
import { OcaTestQuote } from "./OcaTestQuote";
import {
  createShippingMethod, updateShippingMethod, deleteShippingMethod, saveShippingGeneral, saveOcaSettings,
  createZipRestriction, deleteZipRestriction, createZipDiscount, toggleZipDiscount, deleteZipDiscount,
} from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export default async function AdminEnviosPage() {
  const settings = await getStoreSettingsRow();
  const { currency } = settings;
  const [restrictions, zipDiscounts] = await Promise.all([
    prisma.zipCodeRestriction.findMany({ orderBy: [{ type: "asc" }, { zipCode: "asc" }] }),
    prisma.zipCodeDiscount.findMany({ orderBy: { zipCode: "asc" } }),
  ]);
  const fm = (n: number) => formatMoneyWith(n, currency);
  const methods = await getAllShippingMethods();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Envíos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Cada modalidad de envío se prende o apaga con su interruptor y se configura desde acá.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <form action={saveOcaSettings} className="rounded-xl border border-black/10 bg-white p-5">
          <CardAccordion
            titleArea={
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-brand-ink">OCA ePak</p>
                <p className="text-sm text-brand-muted">Tarifa en vivo según peso y medidas, sucursales, registro del envío y rótulo PDF.</p>
              </div>
            }
            headerRight={<ToggleSwitch name="ocaEnabled" defaultChecked={settings.ocaEnabled} />}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-muted">Cuenta corporativa</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className={labelClasses}>CUIT</label><input name="ocaCuit" defaultValue={settings.ocaCuit ?? ""} placeholder="30-12345678-9" className={fieldClasses} /></div>
              <div><label className={labelClasses}>Operativa (a domicilio)</label><input name="ocaOperativa" defaultValue={settings.ocaOperativa ?? ""} className={fieldClasses} /></div>
              <div><label className={labelClasses}>Operativa (a sucursal)</label><input name="ocaOperativaSucursal" defaultValue={settings.ocaOperativaSucursal ?? ""} placeholder="Si no, usa la de domicilio" className={fieldClasses} /></div>
              <div><label className={labelClasses}>Usuario ePak (email)</label><input name="ocaUser" defaultValue={settings.ocaUser ?? ""} autoComplete="off" className={fieldClasses} /></div>
              <div>
                <label className={labelClasses}>Contraseña ePak</label>
                <input name="ocaPassword" type="password" autoComplete="new-password" placeholder={settings.ocaPassword ? "•••••••• (guardada, dejá vacío para no cambiarla)" : ""} className={fieldClasses} />
                {settings.ocaPassword && <label className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted"><input type="checkbox" name="ocaPasswordClear" /> Borrar la contraseña guardada</label>}
              </div>
              <div><label className={labelClasses}>Nº de cliente</label><input name="ocaNroCliente" defaultValue={settings.ocaNroCliente ?? ""} className={fieldClasses} /></div>
            </div>

            <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-brand-muted">Dónde retira OCA (origen)</p>
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-3"><label className={labelClasses}>Calle</label><input name="ocaOriginStreet" defaultValue={settings.ocaOriginStreet ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-1"><label className={labelClasses}>Número</label><input name="ocaOriginNumber" defaultValue={settings.ocaOriginNumber ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-2"><label className={labelClasses}>Piso / Depto</label><input name="ocaOriginFloor" defaultValue={settings.ocaOriginFloor ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-2"><label className={labelClasses}>Ciudad</label><input name="ocaOriginCity" defaultValue={settings.ocaOriginCity ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Provincia</label>
                <select name="ocaOriginProvince" defaultValue={settings.ocaOriginProvince ?? ""} className={fieldClasses}>
                  <option value="">Elegir…</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><label className={labelClasses}>Código postal de origen</label><input name="ocaOriginZipCode" defaultValue={settings.ocaOriginZipCode ?? ""} placeholder="3000" className={fieldClasses} /></div>
              <div className="sm:col-span-3"><label className={labelClasses}>Persona de contacto</label><input name="ocaOriginContact" defaultValue={settings.ocaOriginContact ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-3"><label className={labelClasses}>Email de contacto</label><input name="ocaOriginEmail" type="email" defaultValue={settings.ocaOriginEmail ?? ""} className={fieldClasses} /></div>
              <div className="sm:col-span-3">
                <label className={labelClasses}>Franja horaria del retiro</label>
                <select name="ocaFranjaHoraria" defaultValue={settings.ocaFranjaHoraria} className={fieldClasses}>
                  <option value="1">8 a 17 hs</option>
                  <option value="2">8 a 12 hs</option>
                  <option value="3">14 a 17 hs</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClasses}>Descuento de “retiro en sucursal” (%)</label>
                <input name="ocaBranchDiscountPct" type="number" min={0} max={100} step={1} defaultValue={settings.ocaBranchDiscountPct} className={fieldClasses} />
              </div>
            </div>
            <div className="mt-5 border-t border-black/5 pt-4"><SaveButton trackDirty /></div>
            <OcaTestQuote />
          </CardAccordion>
        </form>

        <form action={saveShippingGeneral} className="rounded-xl border border-black/10 bg-white p-5">
          <CardAccordion
            titleArea={
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-brand-ink">Opciones generales de envío</p>
                <p className="text-sm text-brand-muted">Envío gratis, “a acordar”, medidas por defecto y activación de zonas.</p>
              </div>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-black/10 p-4">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold text-brand-ink">Envío gratis</p><ToggleSwitch name="freeShippingEnabled" defaultChecked={settings.freeShippingEnabled} /></div>
                <label className={`${labelClasses} mt-3`}>Gratis desde un subtotal de ({currency})</label>
                <input type="number" name="freeShippingThreshold" min={0} step={0.01} defaultValue={settings.freeShippingThreshold} className={fieldClasses} />
                <p className="mt-1 text-xs text-brand-muted">Se mide sobre el subtotal de productos, antes de descuentos. También podés crear cupones de “envío gratis” en Cupones.</p>
              </div>
              <div className="rounded-lg border border-black/10 p-4">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold text-brand-ink">Envío a acordar</p><ToggleSwitch name="acordarEnabled" defaultChecked={settings.acordarEnabled} /></div>
                <p className="mt-2 text-xs text-brand-muted">El cliente elige que se coordina el envío con vos (sin costo en el total). En la venta aparece un botón para contactarlo por WhatsApp.</p>
              </div>
              <div className="rounded-lg border border-black/10 p-4">
                <p className="text-sm font-semibold text-brand-ink">Medidas por defecto</p>
                <p className="mt-1 text-xs text-brand-muted">Se usan para cotizar cuando un producto no tiene peso o medidas cargadas.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><label className={labelClasses}>Peso (kg)</label><input type="number" name="shippingDefaultWeightKg" min={0.01} step={0.01} defaultValue={settings.shippingDefaultWeightKg} className={fieldClasses} /></div>
                  <div><label className={labelClasses}>Lado (cm)</label><input type="number" name="shippingDefaultDimCm" min={1} step={1} defaultValue={settings.shippingDefaultDimCm} className={fieldClasses} /></div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-black/10 p-4">
                <div><p className="text-sm font-semibold text-brand-ink">Restricciones por código postal</p><p className="text-xs text-brand-muted">Interruptor general de la lista de abajo.</p></div>
                <ToggleSwitch name="zipRestrictionsEnabled" defaultChecked={settings.zipRestrictionsEnabled} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-black/10 p-4">
                <div><p className="text-sm font-semibold text-brand-ink">Descuentos por código postal</p><p className="text-xs text-brand-muted">Interruptor general de la lista de abajo.</p></div>
                <ToggleSwitch name="zipDiscountsEnabled" defaultChecked={settings.zipDiscountsEnabled} />
              </div>
            </div>
            <div className="mt-5 border-t border-black/5 pt-4"><SaveButton trackDirty /></div>
          </CardAccordion>
        </form>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-base font-semibold text-brand-ink">Zonas restringidas</p><p className="text-sm text-brand-muted">Bloqueá la venta o el envío por correo a ciertos códigos postales ({restrictions.length} cargados).</p></div><span className="text-brand-muted transition-transform group-open:rotate-180">▾</span></summary>
            <div className="mt-4">            <form action={createZipRestriction} className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-3"><label className={labelClasses}>Códigos postales (separados por coma o espacio)</label><input name="zipCodes" required placeholder="9400, 9410" className={fieldClasses} /></div>
              <div className="sm:col-span-3">
                <label className={labelClasses}>Tipo</label>
                <select name="type" className={fieldClasses}>
                  <option value="block_shipping">No se envía por correo (oculta OCA y “a acordar”)</option>
                  <option value="block_sale">No se vende (bloquea la compra)</option>
                </select>
              </div>
              <div className="sm:col-span-6"><label className={labelClasses}>Mensaje para el cliente</label><input name="message" placeholder="Para tu zona la entrega es solo en nuestro local." className={fieldClasses} /></div>
              <div className="sm:col-span-3"><label className={labelClasses}>Dirección del local (opcional)</label><input name="address" className={fieldClasses} /></div>
              <div className="sm:col-span-3"><label className={labelClasses}>Teléfono (opcional)</label><input name="phone" className={fieldClasses} /></div>
              <div className="sm:col-span-6"><SaveButton label="Agregar restricción" /></div>
            </form>
            {restrictions.length > 0 && (
              <ul className="mt-4 divide-y divide-black/5 text-sm">
                {restrictions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="font-mono font-semibold">{r.zipCode}</span>{" "}
                      <Badge tone={r.type === "block_sale" ? "pink" : "green"}>{r.type === "block_sale" ? "No se vende" : "Sin correo"}</Badge>
                      {r.message && <span className="ml-2 text-brand-muted">{r.message}</span>}
                    </span>
                    <form action={deleteZipRestriction.bind(null, r.id)}><button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700">Quitar</button></form>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </details>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-5">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4"><div className="min-w-0 flex-1"><p className="text-base font-semibold text-brand-ink">Descuentos por código postal</p><p className="text-sm text-brand-muted">Descuento automático sobre los productos en ciertas zonas; se suma al del cupón ({zipDiscounts.length} cargados).</p></div><span className="text-brand-muted transition-transform group-open:rotate-180">▾</span></summary>
            <div className="mt-4">            <form action={createZipDiscount} className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-2"><label className={labelClasses}>Códigos postales</label><input name="zipCodes" required placeholder="3000, 3001" className={fieldClasses} /></div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Tipo</label>
                <select name="discountType" className={fieldClasses}><option value="percentage">Porcentaje (%)</option><option value="fixed">Monto fijo ({currency})</option></select>
              </div>
              <div className="sm:col-span-2"><label className={labelClasses}>Valor</label><input name="discountValue" type="number" min={0} step={0.01} required className={fieldClasses} /></div>
              <div className="sm:col-span-4"><label className={labelClasses}>Etiqueta que ve el cliente</label><input name="label" placeholder="Descuento por ser de Santa Fe" className={fieldClasses} /></div>
              <div className="flex items-end sm:col-span-2"><SaveButton label="Agregar descuento" /></div>
            </form>
            {zipDiscounts.length > 0 && (
              <ul className="mt-4 divide-y divide-black/5 text-sm">
                {zipDiscounts.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={d.enabled ? "" : "opacity-50"}>
                      <span className="font-mono font-semibold">{d.zipCode}</span>{" "}
                      <Badge tone="green">{d.discountType === "percentage" ? `${d.discountValue}%` : fm(d.discountValue)}</Badge>
                      {d.label && <span className="ml-2 text-brand-muted">{d.label}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <form action={toggleZipDiscount.bind(null, d.id, !d.enabled)}><button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-brand-ink">{d.enabled ? "Pausar" : "Activar"}</button></form>
                      <form action={deleteZipDiscount.bind(null, d.id)}><button type="submit" className="cursor-pointer text-xs font-medium text-brand-muted hover:text-red-700">Quitar</button></form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          </details>
        </div>
      </div>

      <h2 className="mt-8 text-lg font-bold text-brand-ink">Métodos propios</h2>
      <p className="mt-1 text-sm text-brand-muted">Los que cargás vos a mano (ej. retiro en el local, flete con costo fijo).</p>

      <div className="mt-6 flex flex-col gap-4">
        {methods.map((m) => (
          <form
            key={m.id}
            action={updateShippingMethod}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              m.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="id" value={m.id} />

            <CardAccordion
              titleArea={
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold text-brand-ink">{m.name}</p>
                    {m.cost > 0 ? (
                      <Badge tone="pink">{fm(m.cost)}</Badge>
                    ) : (
                      <Badge tone="green">Gratis</Badge>
                    )}
                  </div>
                  {m.description && <p className="truncate text-sm text-brand-muted">{m.description}</p>}
                </div>
              }
              headerRight={<ToggleSwitch name="enabled" defaultChecked={m.enabled} />}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className={labelClasses}>Nombre</label>
                  <input type="text" name="name" defaultValue={m.name} required className={fieldClasses} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className={labelClasses}>Descripción (opcional)</label>
                  <input
                    type="text"
                    name="description"
                    defaultValue={m.description ?? ""}
                    placeholder="Entrega en 24-48hs en Santa Fe"
                    className={fieldClasses}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div className="w-32">
                  <label className={labelClasses}>Costo</label>
                  <input type="number" name="cost" defaultValue={m.cost} min={0} step={0.01} className={fieldClasses} />
                </div>

                <div className="pb-0.5">
                  <label className={labelClasses}>&nbsp;</label>
                  <ChipCheckbox name="requiresAddress" label="Pide dirección de envío" defaultChecked={m.requiresAddress} />
                </div>
              </div>

              <div className="mt-5 flex gap-3 border-t border-black/5 pt-4">
                <SaveButton trackDirty />
                <button
                  type="submit"
                  formAction={deleteShippingMethod.bind(null, m.id)}
                  className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:border-red-300 hover:text-red-700"
                >
                  Eliminar
                </button>
              </div>
            </CardAccordion>
          </form>
        ))}

        {methods.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-brand-muted">
            Todavía no creaste ningún método de envío.
          </p>
        )}
      </div>

      <div className="mt-6 shrink-0">
        <form action={createShippingMethod} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
          <p className="mb-3 font-semibold text-brand-ink">Nuevo método de envío</p>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <label className={labelClasses}>Nombre</label>
              <input type="text" name="name" required placeholder="Envío a domicilio" className={fieldClasses} />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className={labelClasses}>Descripción (opcional)</label>
              <input type="text" name="description" placeholder="Entrega en 24-48hs en Santa Fe" className={fieldClasses} />
            </div>
            <div className="w-32">
              <label className={labelClasses}>Costo</label>
              <input type="number" name="cost" defaultValue={0} min={0} step={0.01} className={fieldClasses} />
            </div>

            <div className="pb-0.5">
              <label className={labelClasses}>&nbsp;</label>
              <ChipCheckbox name="requiresAddress" label="Pide dirección" defaultChecked />
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
      </div>
    </div>
  );
}
