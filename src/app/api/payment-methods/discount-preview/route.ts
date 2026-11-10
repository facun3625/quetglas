import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePaymentMethodDiscount } from "@/lib/paymentMethodDiscount";
import type { PaymentMethod } from "@/generated/prisma/enums";

// Preview autoritativo del descuento por medio de pago para el carrito
// actual — el cálculo depende de la categoría de cada ítem (ver
// lib/paymentMethodDiscount.ts), así que el checkout no puede resolverlo
// solo con el discountPct plano que ya trae /api/payment-methods.
export async function POST(req: Request) {
  const body = await req.json();
  const { paymentMethod, items } = body as {
    paymentMethod?: PaymentMethod;
    items: { productId: string; quantity: number; price: number }[];
  };

  if (!paymentMethod || !items?.length) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const config = await prisma.paymentMethodConfig.findUnique({
    where: { method: paymentMethod },
    include: { categoryDiscounts: true },
  });
  if (!config?.enabled) {
    return NextResponse.json({ discountAmount: 0 });
  }

  const discountAmount = await calculatePaymentMethodDiscount(items, config);
  return NextResponse.json({ discountAmount });
}
