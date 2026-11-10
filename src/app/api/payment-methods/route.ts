import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensurePaymentMethodConfigsSeeded } from "@/lib/paymentSettings";

// Público: nunca expone las credenciales de Mercado Pago ni la private key de
// Payway. CBU/alias/titular de transferencia sí, porque el checkout los
// necesita mostrarle al cliente para que sepa a dónde transferir. La public
// key de Payway también se expone a propósito: es justamente la que usa
// decidir.js en el navegador para tokenizar la tarjeta (no es secreta).
export async function GET() {
  // Por si en esta instalación todavía nadie entró a /admin/pagos: sin esto,
  // una tienda recién instalada podía quedar sin ningún medio de pago hasta
  // que el admin "descubriera" que había que crear las filas a mano.
  await ensurePaymentMethodConfigsSeeded();

  const configs = await prisma.paymentMethodConfig.findMany({
    where: { enabled: true },
    select: {
      method: true,
      discountPct: true,
      bankCbu: true,
      bankAlias: true,
      bankHolderName: true,
      paywayPublicKey: true,
      paywaySandbox: true,
      mpPublicKey: true,
      noPaymentInstructions: true,
    },
  });

  return NextResponse.json(configs);
}
