import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getAllCategories } from "@/lib/categories";
import { ToggleSwitch } from "@/components/admin/ToggleSwitch";
import { SaveButton } from "@/components/admin/SaveButton";
import { MaskedCredentialField } from "@/components/admin/MaskedCredentialField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { TelegramTestButton } from "./TelegramTestButton";
import { SettingsTabs } from "./SettingsTabs";
import { CategoryChipSelector } from "./CategoryChipSelector";
import { WrenchIcon, PackageIcon, StarIcon, DashboardIcon } from "@/components/icons";
import { LogoField } from "./LogoField";
import { BenefitsEditor } from "./BenefitsEditor";
import { sanitizeBenefits } from "@/lib/benefitIcons";
import { R2Form } from "./R2Form";
import { BackupsPanel } from "./BackupsPanel";
import { UsagePanel } from "./UsagePanel";
import { getUsageStatus } from "@/lib/usage";
import { KEEP_BACKUPS, backupSecret, listBackups } from "@/lib/backup";
import { getR2Config } from "@/lib/storage";
import { getContactCards } from "@/lib/contactCards";
import { resolveContact } from "@/lib/contactInfo";
import { auth } from "@/lib/auth";
import { storeNameOf } from "@/lib/storeName";
import { MailProviderFields } from "@/app/integraciones/MailProviderFields";
import { MailTestButton } from "@/app/integraciones/MailTestButton";
import { updateAiSecretSettings, updateMailProviderSettings } from "@/app/integraciones/actions";
import { DEFAULT_AI_MODELS } from "@/lib/ai/types";
import { DEFAULT_INTRO, DEFAULT_NOTES, DEFAULT_CLOSING } from "@/lib/orderEmails";
import { STATUS_EMAIL_DEFAULTS } from "@/lib/orderStatusEmails";
import { DEFAULT_CHECKOUT_TEXTS } from "@/lib/checkoutTexts";
import { getCashDiscountPct } from "@/lib/paymentSettings";
import { syncNow } from "../puntos/actions";
import {
  updateSiteSettings,
  updateSeoSettings,
  updateMailSettings,
  updateBrandSettings,
  updateTelegramSettings,
  updateOrderEmailSettings,
  updateCheckoutTexts,
  updateMaintenanceMode,
  updateHideOutOfStock,
  updateCategoryDrilldown,
  updateCartAutoCloseSettings,
  updateAiAssistantSettings,
  updatePopupSettings,
  uploadPopupImage,
} from "./actions";

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default async function AdminConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ synced?: string; checked?: string; awarded?: string; skipped?: string }>;
}) {
  const params = await searchParams;
  const [settings, categories, pendingPointsCount, cashDiscountPct] = await Promise.all([
    getStoreSettingsRow(),
    getAllCategories(),
    prisma.order.count({
      where: { pointsAwardedAt: null, userId: { not: null }, status: "delivered" },
    }),
    getCashDiscountPct(),
  ]);

  // Mismos defaults que calcula BenefitsStrip cuando el admin no cargó nada
  // — se muestran como placeholder para que quede claro qué se ve hoy.
  const contactCards = await getContactCards();
  const benefitDefaults = [
    {
      title: cashDiscountPct ? `${cashDiscountPct}% OFF pagando en efectivo` : "Múltiples medios de pago",
      subtitle: cashDiscountPct ? "En toda la tienda" : "Efectivo, transferencia y tarjeta",
    },
    { title: `Envíos a ${settings.franchiseLocation || "Santa Fe"}`, subtitle: "Rápidos y seguros" },
    { title: "Retiro en local", subtitle: resolveContact(settings, contactCards, settings.franchiseLocation || "Santa Fe").address },
  ];


  // --- Panel: General (mantenimiento + datos de contacto) ---
  const generalPanel = (
    <div className="flex flex-col gap-8">
      <form action={updateBrandSettings} className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Logo e íconos</p>
        <p className="mt-1 text-xs text-brand-muted">
          Subí el logo de tu tienda. Sin nada cargado se usa el original de la instalación. Se ve en el sitio, el panel y los mails.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <LogoField
            name="logoHeaderUrl"
            label="Logo del encabezado"
            hint="Arriba en el sitio (y en el panel y los mails). Mejor con fondo transparente (PNG), horizontal."
            initialUrl={settings.logoHeaderUrl ?? ""}
            fallbackUrl="/logo2.png"
          />
          <LogoField
            name="logoFooterUrl"
            label="Logo del pie de página"
            hint="Abajo en el sitio. Si no cargás uno, se usa el del encabezado."
            initialUrl={settings.logoFooterUrl ?? ""}
            fallbackUrl={settings.logoHeaderUrl || "/logo2.png"}
          />
          <LogoField
            name="faviconUrl"
            label="Favicon (ícono de la pestaña)"
            hint="Imagen cuadrada, de 512×512 si podés. También es el ícono al instalar la tienda como app en el celular."
            initialUrl={settings.faviconUrl ?? ""}
            fallbackUrl="/icons/default-icon.png"
            previewClass="h-10"
          />
        </div>
        <div className="mt-5 border-t border-black/5 pt-4">
          <SaveButton trackDirty />
        </div>
      </form>

      <form
        action={updateMaintenanceMode}
        className={`rounded-xl border p-5 transition-colors ${
          settings.maintenanceMode ? "border-amber-300 bg-amber-50" : "border-black/10 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                settings.maintenanceMode ? "bg-amber-100 text-amber-700" : "bg-brand-soft text-brand-muted"
              }`}
            >
              <WrenchIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Modo mantenimiento</p>
              <p className="text-xs text-brand-muted">
                {settings.maintenanceMode
                  ? "El sitio está apagado para clientes ahora mismo — solo ven la pantalla de mantenimiento."
                  : "Apaga el sitio para clientes (ven una pantalla de mantenimiento). Los admins entran igual, panel y sitio."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch name="maintenanceMode" defaultChecked={settings.maintenanceMode} />
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <form action={updateHideOutOfStock} className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-muted">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Ocultar productos sin stock</p>
              <p className="text-xs text-brand-muted">
                {settings.hideOutOfStock
                  ? "Los productos en 0 no aparecen en la tienda ni en el buscador."
                  : "Los productos en 0 se muestran igual, con \"Sin stock\" y el aviso de reposición."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch name="hideOutOfStock" defaultChecked={settings.hideOutOfStock} />
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <form action={updateCategoryDrilldown} className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-muted">
              <DashboardIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Navegar por categorías en tarjetas</p>
              <p className="max-w-xl text-xs text-brand-muted">
                {settings.categoryDrilldownEnabled
                  ? "La tienda muestra primero las categorías como tarjetas; al tocar una se ven sus subcategorías (y así en cascada) hasta llegar a los productos."
                  : "La tienda muestra el menú lateral de categorías de siempre, con los productos a la vista desde el principio."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch name="categoryDrilldownEnabled" defaultChecked={settings.categoryDrilldownEnabled} />
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <form action={updateCartAutoCloseSettings} className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-muted">
              <PackageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Carrito al agregar un producto</p>
              <p className="max-w-xl text-xs text-brand-muted">
                Al agregar algo, el carrito se muestra un momento y se cierra solo, para seguir comprando. Si el cliente
                toca algo dentro, se queda abierto. 0 = no se cierra solo.
              </p>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className={labelClasses}>Se cierra después de (segundos)</label>
              <input
                type="number"
                name="cartAutoCloseSeconds"
                min={0}
                max={10}
                step={1}
                defaultValue={settings.cartAutoCloseSeconds}
                className="w-28 rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none"
              />
            </div>
            <SaveButton trackDirty />
          </div>
        </div>
      </form>

      <div className="rounded-xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-muted">
              <StarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-brand-ink">Acreditación de puntos</p>
              <p className="text-xs text-brand-muted">
                {pendingPointsCount} pedido{pendingPointsCount === 1 ? "" : "s"} sin acreditar
                {settings.pointsLastSync ? ` · última revisión ${timeAgo(settings.pointsLastSync)}` : ""}. Se revisa
                solo cada 15 minutos, o al toque acá.
              </p>
            </div>
          </div>
          <form action={syncNow}>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
            >
              Sincronizar ahora
            </button>
          </form>
        </div>
        {params.synced && (
          <p className="mt-3 rounded-lg border border-brand-pink/20 bg-brand-soft px-3 py-2 text-xs text-brand-ink">
            {params.skipped
              ? "El sistema de puntos está desactivado — no se revisó nada."
              : `Sincronización manual: se revisaron ${params.checked} pedidos pendientes, se acreditaron puntos a ${params.awarded}.`}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">Datos de contacto</h2>
        <form action={updateSiteSettings} className="mt-3 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <label className={labelClasses}>Instagram (usuario, sin @)</label>
              <input
                type="text"
                name="instagramHandle"
                defaultValue={settings.instagramHandle ?? ""}
                placeholder="tutienda"
                className={fieldClasses}
              />
            </div>
            <div className="w-64">
              <label className={labelClasses}>WhatsApp (con código de país, sin +)</label>
              <input
                type="text"
                name="whatsappPhone"
                defaultValue={settings.whatsappPhone ?? ""}
                placeholder="Vacío: se usa el de la primera tarjeta de Contacto"
                className={fieldClasses}
              />
            </div>
            <div className="min-w-[240px] flex-1">
              <label className={labelClasses}>Dirección</label>
              <input
                type="text"
                name="address"
                defaultValue={settings.address ?? ""}
                placeholder="Vacío: se usa la dirección de la primera tarjeta de Contacto"
                className={fieldClasses}
              />
            </div>
            <div className="w-64">
              <label className={labelClasses}>Email de contacto</label>
              <input
                type="email"
                name="contactEmail"
                defaultValue={settings.contactEmail ?? ""}
                placeholder="Ej.: info@tutienda.com"
                className={fieldClasses}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className={labelClasses}>Texto del marquee (uno por línea)</label>
            <textarea
              name="marqueeText"
              rows={3}
              defaultValue={settings.marqueeText ?? ""}
              placeholder={"Nueva colección\nPromociones\nEnvíos a todo el país"}
              className={fieldClasses}
            />
            <p className="mt-1 text-xs text-brand-muted">Es la franja que se desplaza debajo del slider del home.</p>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <p className={labelClasses}>Secciones del inicio</p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <ToggleSwitch name="homeOffersEnabled" defaultChecked={settings.homeOffersEnabled} />
                <span className="text-sm text-brand-ink">Ofertas y promociones</span>
                <input name="homeOffersTitle" defaultValue={settings.homeOffersTitle ?? ""} placeholder="Ofertas y promociones" className={`${fieldClasses} max-w-sm`} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ToggleSwitch name="homeFeaturedEnabled" defaultChecked={settings.homeFeaturedEnabled} />
                <span className="text-sm text-brand-ink">Productos destacados</span>
                <input name="homeFeaturedTitle" defaultValue={settings.homeFeaturedTitle ?? ""} placeholder="Lo más elegido de la tienda" className={`${fieldClasses} max-w-sm`} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-brand-muted">
              “Ofertas” muestra solo los productos con precio tachado o promoción vigente. “Destacados” muestra los productos
              marcados como destacados en su ficha (si no marcaste ninguno, los de las categorías destacadas).
            </p>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <label className={labelClasses}>Texto del pie de página</label>
            <textarea
              name="footerText"
              rows={2}
              defaultValue={settings.footerText ?? ""}
              placeholder="Descubrí nuestro catálogo y comprá online de forma simple y segura."
              className={fieldClasses}
            />
            <p className="mt-1 text-xs text-brand-muted">Se muestra debajo del logo, en el pie de todas las páginas.</p>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <label className={labelClasses}>Moneda de la tienda</label>
            <select name="currency" defaultValue={settings.currency} className={fieldClasses}>
              <option value="ARS">Pesos argentinos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
            <p className="mt-1 text-xs text-brand-muted">
              Todos los precios del catálogo, el carrito y los pedidos se muestran y cobran en esta moneda. No hay
              conversión: si la cambiás, revisá los precios cargados.
            </p>
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <label className={labelClasses}>Categorías destacadas del home</label>
            <p className="mb-2.5 text-xs text-brand-muted">
              Las que se muestran en &ldquo;Explorá por categoría&rdquo; y &ldquo;Productos destacados&rdquo;, en este
              orden (reordenalas con las flechas). Si no elegís ninguna, se usa una selección por defecto.
            </p>
            <CategoryChipSelector categories={categories} selectedIds={settings.featuredCategoryIds} />
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <label className={labelClasses}>Categorías primero en la tienda</label>
            <p className="mb-2.5 text-xs text-brand-muted">
              Al entrar a la tienda sin filtros, se muestran primero los productos de estas categorías (con sus
              subcategorías), en este orden, y después el resto. Dentro de cada grupo, los productos con stock van antes
              que los agotados. Si el cliente elige una categoría o busca algo, no aplica.
            </p>
            <CategoryChipSelector
              categories={categories}
              selectedIds={settings.shopPriorityCategoryIds}
              name="shopPriorityCategoryIds"
              emptyText="Ninguna elegida — la tienda se ordena alfabéticamente, como siempre."
            />
          </div>

          <div className="mt-5 border-t border-black/5 pt-4">
            <SaveButton trackDirty />
          </div>
        </form>
      </div>
    </div>
  );

  // --- Panel: Mailing (solo identidad de la franquicia) ---
  // El proveedor de envío (SMTP/Resend), sus credenciales y el remitente son
  // configuración técnica y viven en /integraciones junto con la IA — ver
  // el comentario en esa página.
  const mailingPanel = (
    <form action={updateMailSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className={labelClasses}>Identidad de la franquicia</p>
      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <label className={labelClasses}>Nombre de la franquicia</label>
          <input
            type="text"
            name="franchiseName"
            defaultValue={settings.franchiseName ?? ""}
            placeholder="Mi tienda"
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brand-muted">Encabezado de los mailings.</p>
        </div>
        <div className="w-56">
          <label className={labelClasses}>Sucursal / lugar</label>
          <input
            type="text"
            name="franchiseLocation"
            defaultValue={settings.franchiseLocation ?? ""}
            placeholder="Santa Fe"
            className={fieldClasses}
          />
          <p className="mt-1 text-xs text-brand-muted">
            Mailings y el badge de la barra superior del sitio público.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Correo (proveedor de envío: se habilita SMTP o Resend, uno de los dos) ---
  // Lo técnico (correo e imágenes/R2) solo lo ve el superadministrador
  const isSuper = (await auth())?.user?.role === "superadmin";
  // Franja de beneficios: lo que se ve hoy (la lista guardada o, si no hay, los 3 de siempre con sus textos reales)
  const savedBenefits = sanitizeBenefits(settings.homeBenefits);
  const currentBenefits =
    savedBenefits.length > 0
      ? savedBenefits
      : benefitDefaults.map((d, i) => {
          const legacy = [
            { icon: settings.benefit1Icon, title: settings.benefit1Title, subtitle: settings.benefit1Subtitle },
            { icon: settings.benefit2Icon, title: settings.benefit2Title, subtitle: settings.benefit2Subtitle },
            { icon: settings.benefit3Icon, title: settings.benefit3Title, subtitle: settings.benefit3Subtitle },
          ][i];
          return { icon: legacy.icon || ["tag", "truck", "store"][i], title: legacy.title?.trim() || d.title, subtitle: legacy.subtitle?.trim() || d.subtitle };
        });
  const benefitsPanel = <BenefitsEditor initial={currentBenefits} hasCustom={savedBenefits.length > 0} />;

  const r2 = isSuper ? await getR2Config() : null;
  const r2Panel = (
    <R2Form
      initial={{
        accountId: settings.r2AccountId ?? "",
        bucket: settings.r2Bucket ?? "",
        publicUrl: settings.r2PublicUrl ?? "",
        hasAccessKey: Boolean(settings.r2AccessKeyId),
        hasSecret: Boolean(settings.r2SecretAccessKey),
      }}
      source={r2?.source ?? "disco"}
    />
  );

  const backupList = isSuper ? await listBackups().catch(() => []) : [];
  const backupsPanel = (
    <BackupsPanel
      backups={backupList.map((b) => ({ name: b.name, size: b.size, modified: b.modified.toISOString(), kind: b.kind }))}
      configured={backupSecret() !== null}
      where={r2 ? "r2" : "disco"}
      keep={KEEP_BACKUPS}
    />
  );

  const usagePanel = <UsagePanel status={await getUsageStatus()} isSuper={isSuper} />;

  const mailProviderPanel = (
    <form action={updateMailProviderSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm text-brand-muted">
        Elegí con qué proveedor sale el correo de la tienda (avisos de pedidos, mailings, recuperación de contraseña). Está habilitado
        uno solo: el que dejes seleccionado. Los datos del otro quedan guardados por si querés volver a cambiar.
      </p>
      <MailProviderFields
        provider={settings.mailProvider === "resend" ? "resend" : "smtp"}
        smtp={{
          host: settings.smtpHost ?? "",
          port: settings.smtpPort ?? 587,
          secure: settings.smtpSecure,
          user: settings.smtpUser ?? "",
          passwordConfigured: Boolean(settings.smtpPassword),
        }}
        resendConfigured={Boolean(settings.resendApiKey)}
      />
      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Remitente (para ambos proveedores)</p>
      <div className="flex flex-wrap gap-4">
        <div className="w-56">
          <label className={labelClasses}>Nombre del remitente</label>
          <input type="text" name="mailFromName" defaultValue={settings.mailFromName ?? ""} placeholder="Mi tienda" className={fieldClasses} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className={labelClasses}>Email remitente</label>
          <input type="email" name="mailFromEmail" defaultValue={settings.mailFromEmail ?? ""} placeholder="info@tudominio.com" className={fieldClasses} />
        </div>
      </div>
      <MailTestButton />
      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Mail de compra ---
  const textareaClasses = `${fieldClasses} min-h-[70px] resize-y`;
  const orderEmailPanel = (
    <form action={updateOrderEmailSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm text-brand-muted">
        El mail que recibe el cliente apenas compra. El detalle de productos y los totales siempre son los reales
        del pedido — acá editás el mensaje alrededor. Podés usar <code className="rounded bg-brand-soft px-1">{"{nombre}"}</code>{" "}
        y <code className="rounded bg-brand-soft px-1">{"{pedido}"}</code> (se reemplazan por el nombre del cliente y
        el número de pedido). Dejá un campo vacío para usar el texto por defecto que ves de fondo.
      </p>

      <div className="mt-4">
        <label className={labelClasses}>Mensaje de bienvenida</label>
        <textarea
          name="orderEmailIntro"
          defaultValue={settings.orderEmailIntro ?? ""}
          placeholder={DEFAULT_INTRO}
          rows={2}
          className={textareaClasses}
        />
      </div>

      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Nota según el medio de pago</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Transferencia</label>
          <textarea
            name="orderEmailNoteTransfer"
            defaultValue={settings.orderEmailNoteTransfer ?? ""}
            placeholder={DEFAULT_NOTES.transferencia}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Contra entrega</label>
          <textarea
            name="orderEmailNoteCash"
            defaultValue={settings.orderEmailNoteCash ?? ""}
            placeholder={DEFAULT_NOTES.contra_entrega}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Mercado Pago</label>
          <textarea
            name="orderEmailNoteMercadopago"
            defaultValue={settings.orderEmailNoteMercadopago ?? ""}
            placeholder={DEFAULT_NOTES.mercadopago}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Sin pago online</label>
          <textarea
            name="orderEmailNoteNoPayment"
            defaultValue={settings.orderEmailNoteNoPayment ?? ""}
            placeholder={DEFAULT_NOTES.sin_pago}
            rows={2}
            className={textareaClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Payway (tarjeta)</label>
          <textarea
            name="orderEmailNotePayway"
            defaultValue={settings.orderEmailNotePayway ?? ""}
            placeholder={DEFAULT_NOTES.payway}
            rows={2}
            className={textareaClasses}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <label className={labelClasses}>Cierre</label>
        <textarea
          name="orderEmailClosing"
          defaultValue={settings.orderEmailClosing ?? ""}
          placeholder={DEFAULT_CLOSING}
          rows={2}
          className={textareaClasses}
        />
      </div>

      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Avisos al cambiar el estado del pedido</p>
      <p className="mb-3 text-xs text-brand-muted">
        Cuando cambiás el estado de un pedido desde Ventas, el comprador recibe un mail. Podés apagar cada aviso o
        editar su texto (dejalo vacío para usar el de fondo).
      </p>
      <div className="flex flex-col gap-4">
        {(
          [
            { key: "Confirmed", label: "Pedido confirmado", enabled: settings.statusEmailConfirmedEnabled, text: settings.statusEmailConfirmedText, def: STATUS_EMAIL_DEFAULTS.confirmed!.text },
            { key: "Delivered", label: "Pedido entregado", enabled: settings.statusEmailDeliveredEnabled, text: settings.statusEmailDeliveredText, def: STATUS_EMAIL_DEFAULTS.delivered!.text },
            { key: "Cancelled", label: "Pedido cancelado", enabled: settings.statusEmailCancelledEnabled, text: settings.statusEmailCancelledText, def: STATUS_EMAIL_DEFAULTS.cancelled!.text },
          ] as const
        ).map((item) => (
          <div key={item.key} className="rounded-lg border border-black/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-brand-ink">{item.label}</label>
              <ToggleSwitch name={`statusEmail${item.key}Enabled`} defaultChecked={item.enabled} />
            </div>
            <textarea
              name={`statusEmail${item.key}Text`}
              defaultValue={item.text ?? ""}
              placeholder={item.def}
              rows={2}
              className={`${textareaClasses} mt-2`}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Checkout y mensajes ---
  const checkoutPanel = (
    <form action={updateCheckoutTexts} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm text-brand-muted">
        Textos que ve el cliente al comprar. Dejá un campo vacío para usar el texto por defecto que ves de fondo.
      </p>
      <div className="mt-4">
        <label className={labelClasses}>Aviso en el checkout (opcional)</label>
        <textarea
          name="checkoutNotice"
          defaultValue={settings.checkoutNotice ?? ""}
          placeholder="Ej.: Envíos a todo el país en 48 hs. Retiro sin cargo en el local."
          rows={2}
          className={textareaClasses}
        />
        <p className="mt-1 text-xs text-brand-muted">Se muestra arriba del formulario de compra. Vacío = no se muestra nada.</p>
      </div>
      <p className={`${labelClasses} mt-5 border-t border-black/5 pt-4`}>Pantalla de pedido registrado</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClasses}>Título</label>
          <input name="successTitle" defaultValue={settings.successTitle ?? ""} placeholder={DEFAULT_CHECKOUT_TEXTS.successTitle} className={fieldClasses} />
        </div>
        <div>
          <label className={labelClasses}>Mensaje general</label>
          <textarea name="successMessage" defaultValue={settings.successMessage ?? ""} placeholder={DEFAULT_CHECKOUT_TEXTS.success} rows={2} className={textareaClasses} />
        </div>
        {(
          [
            ["successMessageTransfer", "Mensaje con transferencia", settings.successMessageTransfer, DEFAULT_CHECKOUT_TEXTS.successByMethod.transferencia],
            ["successMessageCash", "Mensaje con pago contra entrega", settings.successMessageCash, DEFAULT_CHECKOUT_TEXTS.successByMethod.contra_entrega],
            ["successMessageMercadopago", "Mensaje con Mercado Pago", settings.successMessageMercadopago, DEFAULT_CHECKOUT_TEXTS.successByMethod.mercadopago],
            ["successMessagePayway", "Mensaje con tarjeta (Payway)", settings.successMessagePayway, DEFAULT_CHECKOUT_TEXTS.successByMethod.payway],
            ["successMessageNoPayment", "Mensaje sin pago online", settings.successMessageNoPayment, DEFAULT_CHECKOUT_TEXTS.successByMethod.sin_pago],
          ] as const
        ).map(([name, text, value, placeholder]) => (
          <div key={name}>
            <label className={labelClasses}>{text}</label>
            <textarea name={name} defaultValue={value ?? ""} placeholder={placeholder} rows={2} className={textareaClasses} />
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Telegram ---
  const telegramPanel = (
    <form action={updateTelegramSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="mb-4 text-sm text-brand-muted">
        Cuando entra una venta web, el equipo recibe un mensaje al instante en un grupo de Telegram. Creá un bot con{" "}
        <span className="font-medium text-brand-ink">@BotFather</span>, agregá el bot a tu grupo, y cargá acá el token y
        el ID del chat.
      </p>
      <div className="flex flex-wrap gap-4">
        <MaskedCredentialField
          name="telegramBotToken"
          label="Token del bot"
          configured={Boolean(settings.telegramBotToken)}
          placeholder="123456789:ABCdef..."
        />
        <div className="w-48">
          <label className={labelClasses}>ID del chat / grupo</label>
          <input
            type="text"
            name="telegramChatId"
            defaultValue={settings.telegramChatId ?? ""}
            placeholder="-1001234567890"
            className={fieldClasses}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
        <TelegramTestButton />
      </div>
    </form>
  );

  const weekDays = [
    { value: 1, label: "Lun" },
    { value: 2, label: "Mar" },
    { value: 3, label: "Mié" },
    { value: 4, label: "Jue" },
    { value: 5, label: "Vie" },
    { value: 6, label: "Sáb" },
    { value: 0, label: "Dom" },
  ];
  // El dueño maneja acá el contenido comercial y la disponibilidad. Solo el
  // proveedor, modelo y API key quedan en /integraciones como configuración
  // técnica de la instalación.
  const aiProviderForm = (
    <form action={updateAiSecretSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <p className="font-semibold text-brand-ink">Proveedor de IA</p>
      <p className="mt-1 text-xs text-brand-muted">Con qué servicio funciona la vendedora virtual: proveedor, modelo y API key.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="min-w-[220px] flex-1">
          <label className={labelClasses}>Proveedor</label>
          <select name="aiProvider" defaultValue={settings.aiProvider ?? ""} className={fieldClasses}>
            <option value="">Elegir más adelante</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </select>
          <p className="mt-1 text-xs text-brand-muted">Si cambiás de proveedor, cargá también su nueva API key.</p>
        </div>
        <div className="min-w-[220px] flex-1">
          <label className={labelClasses}>Modelo</label>
          <input type="text" name="aiModel" defaultValue={settings.aiModel ?? ""} placeholder="Se completa según el proveedor" className={fieldClasses} />
          <p className="mt-1 text-xs text-brand-muted">Recomendados: {DEFAULT_AI_MODELS.openai} o {DEFAULT_AI_MODELS.gemini}.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <MaskedCredentialField name="aiApiKey" label="API key del proveedor" configured={Boolean(settings.aiApiKey)} placeholder="Pegá la clave privada" type="password" />
      </div>
      <p className="mt-1 text-xs text-brand-muted">La clave se usa únicamente en el servidor y nunca se envía al navegador.</p>
      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  const aiPanel = (
    <div className="flex flex-col gap-5">
    {aiProviderForm}
    <form action={updateAiAssistantSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-5">
        <div>
          <p className="font-semibold text-brand-ink">Vendedora virtual</p>
          <p className="mt-1 max-w-2xl text-xs text-brand-muted">
            Recomienda productos consultando el catálogo, los precios y el stock reales de la tienda. Mientras está apagada (o falta
            configurarla), la tienda muestra en su lugar un botón directo de WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch name="aiAssistantEnabled" defaultChecked={settings.aiAssistantEnabled} />
          <span className="text-sm text-brand-ink">Habilitada</span>
        </div>
      </div>

      {(!settings.aiProvider || !settings.aiApiKey) && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          La vendedora todavía requiere configuración técnica. Hasta que el responsable de la instalación la complete,
          la tienda mostrará el botón de WhatsApp.
        </p>
      )}

      <div className="mt-5 border-t border-black/5 pt-5">
        <p className="text-sm font-semibold text-brand-ink">Identidad e instrucciones de venta</p>
        <p className="mt-1 text-xs text-brand-muted">
          Estos textos definen cómo se presenta la vendedora y qué criterios comerciales debe seguir al responder.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Nombre visible</label>
            <input
              type="text"
              name="aiAssistantName"
              maxLength={60}
              defaultValue={settings.aiAssistantName ?? ""}
              placeholder="Vendedora virtual"
              className={fieldClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Mensaje de bienvenida</label>
            <input
              type="text"
              name="aiWelcomeMessage"
              maxLength={500}
              defaultValue={settings.aiWelcomeMessage ?? ""}
              placeholder="¡Hola! Contame qué estás buscando…"
              className={fieldClasses}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClasses}>Instrucciones para vender</label>
          <textarea
            name="aiInstructions"
            rows={7}
            maxLength={6000}
            defaultValue={settings.aiInstructions ?? ""}
            placeholder={
              "Ejemplo:\n- Priorizá la nueva colección.\n- Preguntá para qué ocasión busca el producto.\n- Mantené un tono cercano y alegre."
            }
            className={`${fieldClasses} resize-y`}
          />
          <p className="mt-1 text-xs text-brand-muted">
            Estas reglas complementan las protecciones fijas: la vendedora no puede inventar stock, precios ni
            descuentos.
          </p>
          <p className="mt-1 text-xs font-medium text-brand-ink">
            No hace falta copiar dirección, contacto, horarios, medios de pago ni envíos: la vendedora los consulta
            automáticamente desde la configuración vigente de la tienda.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-5">
        <p className="text-sm font-semibold text-brand-ink">Horario de WhatsApp</p>
        <p className="mt-1 text-xs text-brand-muted">
          Días y horario en que se ofrece hablar por WhatsApp con una persona: como opción dentro del chat de la
          vendedora, o como botón directo en la tienda mientras la vendedora esté apagada.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {weekDays.map((day) => (
            <label key={day.value} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-brand-ink">
              <input
                type="checkbox"
                name="aiHumanDays"
                value={day.value}
                defaultChecked={(settings.aiHumanDays ?? [1, 2, 3, 4, 5, 6]).includes(day.value)}
                className="accent-brand-pink"
              />
              {day.label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="w-36">
            <label className={labelClasses}>Desde</label>
            <input type="time" name="aiHumanStartTime" defaultValue={settings.aiHumanStartTime} className={fieldClasses} />
          </div>
          <div className="w-36">
            <label className={labelClasses}>Hasta</label>
            <input type="time" name="aiHumanEndTime" defaultValue={settings.aiHumanEndTime} className={fieldClasses} />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
    </div>
  );

  // --- Panel: SEO y etiquetas ---
  const seoPanel = (
    <form action={updateSeoSettings} className="flex flex-col gap-8">
      <section className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Buscadores y redes sociales</p>
        <p className="mt-1 max-w-3xl text-xs text-brand-muted">
          Cómo se ve el sitio en Google y al compartir el link en WhatsApp, Facebook, Instagram o X. Cada producto, categoría y página
          puede tener su propio título y descripción en su edición; esto es lo que se usa para el inicio y lo que no tiene uno propio.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Título del sitio</label>
            <input name="seoTitle" maxLength={70} defaultValue={settings.seoTitle ?? ""} placeholder={storeNameOf(settings)} className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Hasta 70 caracteres. Vacío = el nombre de la tienda.</p>
          </div>
          <div>
            <label className={labelClasses}>Descripción</label>
            <textarea name="seoDescription" maxLength={200} rows={3} defaultValue={settings.seoDescription ?? ""} placeholder="Qué vendés y por qué elegirte, en una o dos frases." className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Entre 120 y 160 caracteres rinde mejor (máximo 200).</p>
          </div>
        </div>
        <div className="mt-4 max-w-xl">
          <LogoField
            name="seoImageUrl"
            label="Imagen para compartir"
            hint="La que aparece al pegar el link en redes. Mejor horizontal, de 1200×630."
            initialUrl={settings.seoImageUrl ?? ""}
            fallbackUrl={null}
            previewClass="h-20"
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/5 pt-4">
          <ToggleSwitch name="seoIndexable" defaultChecked={settings.seoIndexable} />
          <div>
            <p className="text-sm text-brand-ink">Permitir que Google indexe el sitio</p>
            <p className="text-xs text-brand-muted">Apagalo mientras armás la tienda: le pide a los buscadores que no la muestren. Acordate de prenderlo al salir en vivo.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Medición y publicidad</p>
        <p className="mt-1 max-w-3xl text-xs text-brand-muted">
          Pegá solo el código; la tienda arma y carga el script. No se carga dentro del panel, así que tus visitas al admin no se cuentan. Dejalo vacío para no usarlo.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClasses}>Google Analytics 4</label>
            <input name="gaMeasurementId" maxLength={20} defaultValue={settings.gaMeasurementId ?? ""} placeholder="G-XXXXXXXXXX" className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Analytics → Administrar → Flujos de datos.</p>
          </div>
          <div>
            <label className={labelClasses}>Google Tag Manager</label>
            <input name="gtmId" maxLength={20} defaultValue={settings.gtmId ?? ""} placeholder="GTM-XXXXXXX" className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Si usás Tag Manager, no cargues además Analytics acá: se contaría doble.</p>
          </div>
          <div>
            <label className={labelClasses}>Píxel de Meta (Facebook / Instagram)</label>
            <input name="metaPixelId" maxLength={24} defaultValue={settings.metaPixelId ?? ""} placeholder="1234567890123456" className={fieldClasses} />
            <p className="mt-1 text-xs text-brand-muted">Solo el número de ID del píxel.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Verificación del sitio</p>
        <p className="mt-1 max-w-3xl text-xs text-brand-muted">
          Para demostrar que el sitio es tuyo. Podés pegar el código o la etiqueta completa que te da cada servicio.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClasses}>Google Search Console</label>
            <input name="googleSiteVerification" maxLength={300} defaultValue={settings.googleSiteVerification ?? ""} placeholder="código de google-site-verification" className={fieldClasses} />
          </div>
          <div>
            <label className={labelClasses}>Verificación de dominio de Meta</label>
            <input name="facebookDomainVerification" maxLength={300} defaultValue={settings.facebookDomainVerification ?? ""} placeholder="código de facebook-domain-verification" className={fieldClasses} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5">
        <p className="font-semibold text-brand-ink">Otras etiquetas propias</p>
        {isSuper ? (
          <>
            <p className="mt-1 max-w-3xl text-xs text-brand-muted">
              Para cualquier otro servicio: pegá acá sus etiquetas, una debajo de otra, y se cargan en todas las páginas de la tienda (menos en el panel).
              Se aceptan <code>&lt;meta&gt;</code>, <code>&lt;link&gt;</code> y <code>&lt;script&gt;</code>; los enlaces tienen que ser https. Cualquier otra etiqueta se descarta.
            </p>
            <textarea
              name="customHeadCode"
              rows={8}
              maxLength={10000}
              defaultValue={settings.customHeadCode ?? ""}
              spellCheck={false}
              placeholder={'<meta property="fb:app_id" content="123456789" />\n<meta name="p:domain_verify" content="abc123" />'}
              className={`${fieldClasses} mt-3 font-mono text-xs`}
            />
            <p className="mt-1 text-xs text-brand-muted">Un script mal puesto puede romper el sitio: probá la tienda después de guardar.</p>
          </>
        ) : (
          <p className="mt-1 text-xs text-brand-muted">Para sumar etiquetas propias (otros servicios o scripts) pedíselo al superadministrador.</p>
        )}
      </section>

      <div>
        <SaveButton trackDirty />
      </div>
    </form>
  );

  // --- Panel: Pop-up del sitio ---
  const popupPanel = (
    <form action={updatePopupSettings} className="rounded-xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/5 pb-5">
        <div>
          <p className="font-semibold text-brand-ink">Pop-up promocional</p>
          <p className="mt-1 max-w-2xl text-xs text-brand-muted">
            Aparece unos segundos después de entrar al sitio, con el título y el texto que cargues acá abajo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch name="popupEnabled" defaultChecked={settings.popupEnabled} />
          <span className="text-sm text-brand-ink">Habilitado</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Dónde se muestra</label>
          <select name="popupScope" defaultValue={settings.popupScope} className={fieldClasses}>
            <option value="all">Todo el sitio</option>
            <option value="home">Solo home</option>
            <option value="tienda">Solo tienda</option>
          </select>
        </div>
        <div>
          <label className={labelClasses}>Frecuencia</label>
          <select name="popupFrequency" defaultValue={settings.popupFrequency} className={fieldClasses}>
            <option value="once">Una vez por visitante</option>
            <option value="always">Cada vez que entra al sitio</option>
          </select>
          <p className="mt-1 text-xs text-brand-muted">
            &ldquo;Una vez&rdquo; lo recuerda el navegador del visitante — si después editás el texto, vuelve a
            aparecer aunque ya lo hayan visto.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelClasses}>Título</label>
        <input
          type="text"
          name="popupTitle"
          maxLength={100}
          defaultValue={settings.popupTitle ?? ""}
          placeholder="¡Nueva colección ya disponible!"
          className={fieldClasses}
        />
      </div>

      <div className="mt-4">
        <label className={labelClasses}>Texto</label>
        <RichTextEditor
          name="popupBodyHtml"
          initialValue={settings.popupBodyHtml ?? ""}
          placeholder="Escribí el mensaje del pop-up — seleccioná texto para darle formato, o insertá una imagen."
          uploadImage={uploadPopupImage}
        />
      </div>

      <div className="mt-5 border-t border-black/5 pt-4">
        <SaveButton trackDirty />
      </div>
    </form>
  );

  return (
    <div className="flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Configuración</h1>
        <p className="mt-1 text-sm text-brand-muted">Todo lo que se ve en el sitio y las integraciones de la tienda.</p>
      </div>

      <SettingsTabs
        tabs={[
          { id: "general", label: "General", content: generalPanel },
          { id: "beneficios", label: "Beneficios", content: benefitsPanel },
          { id: "mailing", label: "Franquicia", content: mailingPanel },
          ...(isSuper
            ? [
                { id: "correo", label: "Correo", content: mailProviderPanel },
                { id: "imagenes", label: "Imágenes (R2)", content: r2Panel },
                { id: "backups", label: "Copias de seguridad", content: backupsPanel },
              ]
            : []),
          { id: "mail-compra", label: "Mail de compra", content: orderEmailPanel },
          { id: "checkout", label: "Checkout y mensajes", content: checkoutPanel },
          { id: "telegram", label: "Telegram", content: telegramPanel },
          { id: "vendedora", label: "Vendedora IA", content: aiPanel },
          { id: "consumo", label: "Consumo", content: usagePanel },
          { id: "seo", label: "SEO y etiquetas", content: seoPanel },
          { id: "popup", label: "Pop-up", content: popupPanel },
        ]}
      />
    </div>
  );
}
