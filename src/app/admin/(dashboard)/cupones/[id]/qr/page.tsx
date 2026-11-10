import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/siteUrl";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// Cupón QR para imprimir y pegar en el local: al escanearlo se abre la tienda con el cupón ya cargado,
// y se aplica solo al finalizar la compra.
export default async function CouponQrPage({ params }: { params: Promise<{ id: string }> }) {
  const coupon = await prisma.coupon.findUnique({ where: { id: (await params).id } });
  if (!coupon) notFound();
  const url = `${siteUrl()}/?cupon=${encodeURIComponent(coupon.code)}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 280, errorCorrectionLevel: "M" });
  const discount = coupon.discountType === "percentage" ? `${coupon.discountValue}% de descuento` : coupon.discountType === "free_shipping" ? "envío gratis" : `$${coupon.discountValue} de descuento`;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-8 text-center print:py-0">
      <div className="w-full rounded-2xl border border-black/15 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-muted">Cupón de descuento online</p>
        <p className="mt-2 text-2xl font-bold text-brand-ink">{discount}</p>
        <div className="mx-auto mt-4 w-[280px]" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-3 text-sm text-brand-muted">Escaneá el código con la cámara de tu celular y comprá en nuestra tienda online.</p>
        <p className="mt-3 text-lg font-bold tracking-widest text-brand-ink">{coupon.code}</p>
        <p className="mt-1 text-xs text-brand-muted">
          {coupon.expiresAt ? `Válido hasta el ${coupon.expiresAt.toLocaleDateString("es-AR")}. ` : ""}
          {coupon.oneUsePerCustomer ? "Uso único por cliente. " : ""}
          {coupon.minPurchaseAmount ? `Compra mínima $${coupon.minPurchaseAmount}.` : ""}
        </p>
      </div>
      <p className="mt-4 break-all text-xs text-brand-muted print:hidden">{url}</p>
      {!coupon.enabled && <p className="mt-2 text-xs font-semibold text-amber-700 print:hidden">Ojo: este cupón está desactivado.</p>}
      <PrintButton />
    </div>
  );
}
