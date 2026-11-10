import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCheckoutItems } from "@/lib/checkout";
import { InvalidCheckoutError } from "@/lib/checkoutItems";
import { validateCoupon } from "@/lib/coupons";
import { getContactInfo } from "@/lib/settings";
import { getShippingOptions } from "@/lib/shippingFlow";

// Público: las opciones de envío que se le muestran al cliente según su código postal y su carrito.
// Es solo para mostrar; al crear el pedido el servidor vuelve a calcular todo (lib/orderPricing.ts).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    zipCode?: string;
    items?: unknown;
    paymentMethod?: string;
    couponCode?: string;
    email?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  try {
    const items = await getCheckoutItems(body.items);
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const paymentMethod = typeof body.paymentMethod === "string" ? body.paymentMethod : "";
    const config = paymentMethod
      ? await prisma.paymentMethodConfig.findFirst({ where: { method: paymentMethod as never, enabled: true } })
      : null;

    let couponFreeShipping = false;
    if (typeof body.couponCode === "string" && body.couponCode) {
      const session = await auth();
      const coupon = await validateCoupon(body.couponCode, {
        subtotal,
        paymentMethod,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        userId: session?.user?.id,
        customerEmail: body.email,
      });
      couponFreeShipping = coupon.ok && coupon.freeShipping;
    }

    const result = await getShippingOptions({
      zipCode: typeof body.zipCode === "string" ? body.zipCode : "",
      items,
      subtotal,
      paymentMethodConfigId: config?.id,
      couponFreeShipping,
    });
    const contact = await getContactInfo();
    return NextResponse.json({ ...result, contact: { whatsapp: contact.whatsappNumber } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof InvalidCheckoutError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("POST /api/shipping/options failed", err);
    return NextResponse.json({ error: "No se pudieron calcular las opciones de envío" }, { status: 502 });
  }
}
