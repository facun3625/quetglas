import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatOrderNumber } from "@/lib/orderNumber";
import { getCheckoutTexts } from "@/lib/checkoutTexts";
import { getContactInfo } from "@/lib/settings";
import { buildWhatsAppLink, isLikelyPhone } from "@/lib/whatsapp";
import { formatMoneyWith } from "@/lib/money";

export default async function GraciasPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const order = id && /^[A-Za-z0-9_-]{1,64}$/.test(id)
    ? await prisma.order.findUnique({ where: { id }, select: { number: true, paymentMethod: true, total: true, currency: true, items: { select: { name: true, quantity: true } } } })
    : null;
  const texts = await getCheckoutTexts();
  // "Sin pago online": si el admin lo dejó activado, se ofrece mandar el pedido por WhatsApp a la tienda
  let whatsappHref: string | null = null;
  if (order?.paymentMethod === "sin_pago") {
    const [config, contact] = await Promise.all([
      prisma.paymentMethodConfig.findUnique({ where: { method: "sin_pago" }, select: { noPaymentWhatsapp: true } }),
      getContactInfo(),
    ]);
    const phone = contact.whatsappNumber;
    if (config?.noPaymentWhatsapp && isLikelyPhone(phone)) {
      const lines = order.items.map((i) => `• ${i.quantity}x ${i.name}`).join("\n");
      whatsappHref = buildWhatsAppLink(
        phone,
        `Hola! Hice el pedido ${formatOrderNumber(order.number)} en la tienda:\n${lines}\nTotal: ${formatMoneyWith(order.total, order.currency)}\n¿Coordinamos el pago y la entrega?`
      );
    }
  }
  const message = order ? texts.successByMethod[order.paymentMethod] ?? texts.success : texts.success;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
        </svg>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-brand-ink">{texts.successTitle}</h1>
      <p className="mt-2 text-brand-muted">
        {order && <>Pedido {formatOrderNumber(order.number)}. </>}
        {message}
      </p>

      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 rounded-full bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          Enviar mi pedido por WhatsApp
        </a>
      )}

      <Link
        href="/tienda"
        className="mt-8 rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark"
      >
        Seguir comprando
      </Link>
    </div>
  );
}
