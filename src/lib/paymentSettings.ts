import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/generated/prisma/enums";

const ALL_METHODS: PaymentMethod[] = ["mercadopago", "transferencia", "contra_entrega", "payway", "sin_pago"];

// Transferencia y contra entrega no dependen de ningún gateway externo, así
// que arrancan habilitadas de una — la tienda puede vender desde el minuto
// uno de la instalación. Payway y Mercado Pago necesitan credenciales de
// verdad (public/private key) antes de poder cobrar, así que arrancan
// apagadas hasta que el admin las carga en /admin/pagos.
// "Sin pago online" arranca apagado: el admin elige si lo ofrece.
const NO_EXTERNAL_CREDENTIALS: PaymentMethod[] = ["transferencia", "contra_entrega"];

// Se auto-crean las filas faltantes (una por medio de pago) la primera vez
// que hace falta — tanto desde /admin/pagos como desde el checkout público —
// así no hace falta un seed aparte y una instalación nueva ya tiene algo
// vendible sin que el admin tenga que "descubrir" que hay que crear filas.
async function ensurePaymentMethodConfigsSeeded() {
  const existing = await prisma.paymentMethodConfig.findMany({ select: { method: true } });
  const have = new Set(existing.map((c) => c.method));
  const missing = ALL_METHODS.filter((m) => !have.has(m));
  if (missing.length === 0) return;

  await prisma.paymentMethodConfig.createMany({
    data: missing.map((method) => ({ method, enabled: NO_EXTERNAL_CREDENTIALS.includes(method) })),
    skipDuplicates: true,
  });
}

export async function getPaymentMethodConfigs() {
  await ensurePaymentMethodConfigsSeeded();
  const all = await prisma.paymentMethodConfig.findMany({
    include: { allowedShipping: true, categoryDiscounts: true },
  });
  const byMethod = new Map(all.map((c) => [c.method, c]));
  return ALL_METHODS.map((m) => byMethod.get(m)!);
}

export { ensurePaymentMethodConfigsSeeded };

// Versión liviana de getPaymentMethodConfigs para consumo público (ej. el
// home) — evita traer credenciales/relaciones que ese contexto no necesita.
export async function getCashDiscountPct(): Promise<number | null> {
  const config = await prisma.paymentMethodConfig.findUnique({
    where: { method: "contra_entrega" },
    select: { enabled: true, discountPct: true },
  });
  return config?.enabled && config.discountPct > 0 ? config.discountPct : null;
}
