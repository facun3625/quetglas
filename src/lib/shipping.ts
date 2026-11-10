import { prisma } from "@/lib/prisma";

// Instalación nueva: si todavía no hay NINGÚN método de envío cargado, se
// siembran los dos más comunes para que la tienda arranque vendible desde el
// primer minuto (mismo espíritu que los medios de pago, ver
// paymentSettings.ts). El admin los edita, renombra o apaga cuando quiera —
// es un punto de partida, no algo forzado: si ya hay al menos uno cargado
// (aunque el admin haya borrado los que sembramos acá) no se vuelve a tocar.
async function ensureDefaultShippingMethods() {
  const count = await prisma.shippingMethod.count();
  if (count > 0) return;
  await prisma.shippingMethod.createMany({
    data: [
      { name: "Retiro en el local", cost: 0, requiresAddress: false, enabled: true },
      { name: "Envío a domicilio", cost: 0, requiresAddress: true, enabled: true },
    ],
  });
}

export async function getAllShippingMethods() {
  await ensureDefaultShippingMethods();
  return prisma.shippingMethod.findMany({ orderBy: { createdAt: "asc" } });
}

// Restricciones de envío de un medio de pago: los métodos propios marcados (PaymentMethodShipping) y las
// modalidades de la tienda marcadas (OCA domicilio/sucursal, a acordar). Si no hay NADA marcado, acepta cualquier
// envío habilitado; si hay algo marcado, solo lo marcado.
async function paymentShippingRules(paymentMethodConfigId: string) {
  const [rows, config] = await Promise.all([
    prisma.paymentMethodShipping.findMany({ where: { paymentMethodConfigId }, select: { shippingMethodId: true } }),
    prisma.paymentMethodConfig.findUnique({ where: { id: paymentMethodConfigId }, select: { allowedShippingCodes: true } }),
  ]);
  const manualIds = rows.map((r) => r.shippingMethodId);
  const codes = config?.allowedShippingCodes ?? [];
  return { restricted: manualIds.length > 0 || codes.length > 0, manualIds, codes };
}

export async function getShippingMethodsForPayment(paymentMethodConfigId: string) {
  await ensureDefaultShippingMethods();
  const rules = await paymentShippingRules(paymentMethodConfigId);
  if (!rules.restricted) {
    return prisma.shippingMethod.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  }
  return prisma.shippingMethod.findMany({
    where: { id: { in: rules.manualIds }, enabled: true },
    orderBy: { createdAt: "asc" },
  });
}

// Modalidades de la tienda (oca_domicilio, oca_sucursal, acordar) permitidas con este medio de pago. null = todas.
export async function getAllowedBuiltinCodes(paymentMethodConfigId: string): Promise<string[] | null> {
  const rules = await paymentShippingRules(paymentMethodConfigId);
  return rules.restricted ? rules.codes : null;
}
