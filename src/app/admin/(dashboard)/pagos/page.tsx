import { getPaymentMethodConfigs } from "@/lib/paymentSettings";
import { getAllShippingMethods } from "@/lib/shipping";
import { getStoreSettingsRow } from "@/lib/settings";
import { getAllCategories } from "@/lib/categories";
import { paymentMethodLabel } from "@/lib/sales";
import { PaymentEnabledToggle } from "@/components/admin/PaymentEnabledToggle";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { ChipCheckbox } from "@/components/admin/ChipCheckbox";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { SaveButton } from "@/components/admin/SaveButton";
import { CardAccordion } from "@/components/admin/CardAccordion";
import {
  savePaymentMethodConfig,
  upsertPaymentMethodCategoryDiscount,
  deletePaymentMethodCategoryDiscount,
} from "./actions";

const METHOD_DESCRIPTIONS: Record<string, string> = {
  mercadopago: "Pago con tarjeta directo en el checkout vía Mercado Pago. Se cobra y confirma al toque — no incluye efectivo.",
  transferencia: "El cliente transfiere y adjunta el comprobante al finalizar la compra.",
  contra_entrega: "El cliente paga en efectivo al recibir el pedido.",
  payway: "Pago con tarjeta directo en el checkout (gateway Payway). Se cobra y confirma al toque.",
  sin_pago: "El cliente hace el pedido sin pagar online. Entra igual al panel y se coordina el pago y la entrega por WhatsApp o email.",
};

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export default async function AdminPagosPage() {
  const [configs, shippingMethods, categories] = await Promise.all([
    getPaymentMethodConfigs(),
    getAllShippingMethods(),
    getAllCategories(),
  ]);
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  // Modalidades de la tienda que están prendidas en Envíos (las apagadas no se pueden elegir acá)
  const shippingSettings = await getStoreSettingsRow();
  const builtinShipping = [
    ...(shippingSettings.ocaEnabled ? [{ code: "oca_domicilio", label: "OCA a domicilio" }, { code: "oca_sucursal", label: "OCA a sucursal" }] : []),
    ...(shippingSettings.acordarEnabled ? [{ code: "acordar", label: "Envío a acordar" }] : []),
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Pagos</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Habilitá los medios de pago que aceptás y, si querés, aplicá un descuento a cada uno.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {configs.map((config) => (
          <form
            key={config.method}
            action={savePaymentMethodConfig}
            className={`rounded-xl border bg-white p-5 transition-colors ${
              config.enabled ? "border-brand-pink/30" : "border-black/10"
            }`}
          >
            <input type="hidden" name="method" value={config.method} />

            <CardAccordion
              titleArea={
                <div>
                  <p className="font-semibold text-brand-ink">{paymentMethodLabel(config.method)}</p>
                  <p className="mt-0.5 text-sm text-brand-muted">{METHOD_DESCRIPTIONS[config.method]}</p>
                </div>
              }
              headerRight={<PaymentEnabledToggle method={config.method} enabled={config.enabled} />}
            >
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-48">
                  <label className={`${labelClasses} whitespace-nowrap`}>Descuento base (%)</label>
                  <input
                    type="number"
                    name="discountPct"
                    defaultValue={config.discountPct}
                    min={0}
                    max={100}
                    step={0.1}
                    className={fieldClasses}
                  />
                </div>

                {config.method === "mercadopago" && (
                  <>
                    <MaskedCredentialField
                      name="mpAccessToken"
                      label="Access Token"
                      type="password"
                      configured={Boolean(config.mpAccessToken)}
                      placeholder="APP_USR-..."
                    />
                    <MaskedCredentialField
                      name="mpPublicKey"
                      label="Public Key"
                      configured={Boolean(config.mpPublicKey)}
                      placeholder="APP_USR-..."
                    />
                    <MaskedCredentialField
                      name="mpWebhookSecret"
                      label="Clave secreta del webhook"
                      type="password"
                      configured={Boolean(config.mpWebhookSecret)}
                      placeholder="Clave secreta de las notificaciones"
                    />
                    <div className="w-full rounded-lg border border-black/10 bg-brand-soft/40 p-3 text-xs text-brand-muted">
                      <p className="font-semibold text-brand-ink">Notificaciones (webhooks) de Mercado Pago</p>
                      <p className="mt-1">
                        En Mercado Pago → Tus integraciones → Webhooks, cargá esta URL (evento <b>Pagos</b>) y pegá acá la clave
                        secreta que te muestra:
                      </p>
                      <code className="mt-1.5 block select-all break-all rounded bg-white px-2 py-1.5 text-brand-ink">
                        {(process.env.NEXTAUTH_URL ?? "https://tu-sitio.com").replace(/\/$/, "")}/api/webhooks/mercadopago
                      </code>
                      <p className="mt-1.5">
                        Con eso, si un pago queda en duda (corte de internet, pago pendiente, devolución, contracargo) el pedido se
                        corrige solo. También podés conciliar un pedido a mano desde Ventas.
                      </p>
                    </div>
                  </>
                )}

                {config.method === "payway" && (
                  <>
                    <MaskedCredentialField
                      name="paywayPublicKey"
                      label="Public Key"
                      configured={Boolean(config.paywayPublicKey)}
                      placeholder="pub_..."
                    />
                    <MaskedCredentialField
                      name="paywayPrivateKey"
                      label="Private Key"
                      type="password"
                      configured={Boolean(config.paywayPrivateKey)}
                      placeholder="priv_..."
                    />
                    <div className="flex items-center gap-2.5 pb-2">
                      <ToggleSwitch name="paywaySandbox" defaultChecked={config.paywaySandbox} />
                      <div>
                        <p className="text-sm font-medium text-brand-ink">Modo de prueba (sandbox)</p>
                        <p className="text-xs text-brand-muted">
                          Apagalo recién cuando tengas las keys de producción.
                        </p>
                      </div>
                    </div>
                    <p className="w-full text-xs text-brand-muted">
                      Las keys te las da el soporte de Payway (soporte@payway.com.ar).
                    </p>
                  </>
                )}

                {config.method === "sin_pago" && (
                  <>
                    <div className="flex w-full flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-brand-ink">
                        <ToggleSwitch name="noPaymentWhatsapp" defaultChecked={config.noPaymentWhatsapp} />
                        Ofrecer al cliente enviar el pedido por WhatsApp
                      </label>
                      <label className="flex items-center gap-2 text-sm text-brand-ink">
                        <ToggleSwitch name="noPaymentEmail" defaultChecked={config.noPaymentEmail} />
                        Avisar por mail a la tienda
                      </label>
                    </div>
                    <div className="w-full">
                      <label className={labelClasses}>Instrucciones que ve el cliente en el checkout</label>
                      <textarea
                        name="noPaymentInstructions"
                        defaultValue={config.noPaymentInstructions ?? ""}
                        rows={2}
                        placeholder="Registramos tu pedido y nos ponemos en contacto con vos para coordinar el pago y la entrega."
                        className={fieldClasses}
                      />
                      <p className="mt-1 text-xs text-brand-muted">
                        El WhatsApp usa el número cargado en Configuración → General, y el mail va al email de contacto de la tienda.
                      </p>
                    </div>
                  </>
                )}

                {config.method === "transferencia" && (
                  <>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>Titular</label>
                      <input
                        type="text"
                        name="bankHolderName"
                        defaultValue={config.bankHolderName ?? ""}
                        placeholder="Nombre del titular de la cuenta"
                        className={fieldClasses}
                      />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>CBU</label>
                      <input
                        type="text"
                        name="bankCbu"
                        defaultValue={config.bankCbu ?? ""}
                        placeholder="0000003100000000000000"
                        className={fieldClasses}
                      />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <label className={labelClasses}>Alias</label>
                      <input
                        type="text"
                        name="bankAlias"
                        defaultValue={config.bankAlias ?? ""}
                        placeholder="tutienda.mp"
                        className={fieldClasses}
                      />
                    </div>
                  </>
                )}
              </div>

              {categories.length > 0 && (
                <div className="mt-5 border-t border-black/5 pt-4">
                  <p className="mb-2.5 text-xs font-medium text-brand-muted">
                    Excepciones por categoría{" "}
                    <span className="font-normal normal-case text-brand-muted/70">
                      (reemplazan el descuento por defecto para esa categoría y sus subcategorías)
                    </span>
                  </p>

                  {config.categoryDiscounts.length > 0 && (
                    <ul className="mb-3 flex flex-col gap-2">
                      {config.categoryDiscounts.map((cd) => (
                        <li
                          key={cd.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm"
                        >
                          <span className="text-brand-ink">
                            {categoryNameById.get(cd.categoryId) ?? `Categoría #${cd.categoryId}`}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-brand-pink-dark">{cd.discountPct}%</span>
                            <button
                              type="submit"
                              formAction={deletePaymentMethodCategoryDiscount.bind(null, cd.id)}
                              className="cursor-pointer text-xs font-medium text-brand-muted transition-colors hover:text-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-56">
                      <label className={labelClasses}>Categoría</label>
                      <select name="newCategoryId" defaultValue="" className={`${fieldClasses} bg-white`}>
                        <option value="" disabled>
                          Elegir categoría
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-28">
                      <label className={labelClasses}>Descuento (%)</label>
                      <input
                        type="number"
                        name="newCategoryDiscountPct"
                        min={0}
                        max={100}
                        step={0.1}
                        className={fieldClasses}
                      />
                    </div>
                    <button
                      type="submit"
                      formAction={upsertPaymentMethodCategoryDiscount.bind(null, config.id)}
                      className="cursor-pointer rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:border-brand-pink/40 hover:text-brand-pink-dark"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              )}

              {(shippingMethods.length > 0 || builtinShipping.length > 0) && (
                <div className="mt-5 border-t border-black/5 pt-4">
                  <p className="mb-2.5 text-xs font-medium text-brand-muted">
                    Envíos permitidos con este medio de pago{" "}
                    <span className="font-normal normal-case text-brand-muted/70">
                      (ninguno marcado = acepta cualquier envío habilitado)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {builtinShipping.map((b) => (
                      <ChipCheckbox
                        key={b.code}
                        name="shippingCodes"
                        value={b.code}
                        label={b.label}
                        defaultChecked={config.allowedShippingCodes.includes(b.code)}
                      />
                    ))}
                    {shippingMethods.map((s) => (
                      <ChipCheckbox
                        key={s.id}
                        name="shippingMethodIds"
                        value={s.id}
                        label={s.name}
                        defaultChecked={config.allowedShipping.some((a) => a.shippingMethodId === s.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 border-t border-black/5 pt-4">
                <SaveButton trackDirty />
              </div>
            </CardAccordion>
          </form>
        ))}
      </div>
    </div>
  );
}
