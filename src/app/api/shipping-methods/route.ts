import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getShippingMethodsForPayment } from "@/lib/shipping";
import type { PaymentMethod } from "@/generated/prisma/enums";

const VALID_METHODS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];

function isPaymentMethod(value: string): value is PaymentMethod {
  return (VALID_METHODS as string[]).includes(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const paymentMethod = searchParams.get("paymentMethod");

  if (!paymentMethod || !isPaymentMethod(paymentMethod)) {
    const methods = await prisma.shippingMethod.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(methods);
  }

  const config = await prisma.paymentMethodConfig.findUnique({ where: { method: paymentMethod } });
  if (!config) return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });

  const methods = await getShippingMethodsForPayment(config.id);
  return NextResponse.json(methods);
}
