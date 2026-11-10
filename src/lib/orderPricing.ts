import type { Prisma } from "@/generated/prisma/client";
import type { CheckoutItem } from "@/lib/checkoutItems";
import { validateCoupon } from "@/lib/coupons";
import { calculatePaymentMethodDiscount } from "@/lib/paymentMethodDiscount";
import { resolveShipping, roundMoney, stackDiscounts, type ShippingChoice } from "@/lib/shippingFlow";

// Cálculo del pedido en el servidor, compartido por las tres rutas que lo crean (transferencia/contra entrega,
// Mercado Pago y Payway). Nada de lo que muestra el navegador se toma como válido: el envío se re-cotiza,
// el cupón y los descuentos se recalculan y el total sale de acá.

type PaymentConfig = Parameters<typeof calculatePaymentMethodDiscount>[1] & { id: string };

export type PricedOrder =
  | {
      ok: true;
      subtotal: number;
      total: number;
      couponId: string | undefined;
      couponDiscount: number;
      zipDiscount: number;
      shippingCost: number;
      shippingFields: Pick<
        Prisma.OrderUncheckedCreateInput,
        "shippingMethodId" | "shippingCost" | "shippingAddress" | "shippingCode" | "shippingName" | "shippingData"
      >;
    }
  | { ok: false; error: string; status: number };

export function parseShippingChoice(raw: unknown): ShippingChoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code !== "string") return null;
  return {
    code: r.code,
    branchId: typeof r.branchId === "string" ? r.branchId : undefined,
    address: r.address && typeof r.address === "object" ? (r.address as ShippingChoice["address"]) : undefined,
  };
}

export async function priceOrder(args: {
  items: CheckoutItem[];
  config: PaymentConfig;
  paymentMethod: string;
  shipping: unknown;
  couponCode?: unknown;
  userId?: string;
  customerEmail: string;
}): Promise<PricedOrder> {
  const choice = parseShippingChoice(args.shipping);
  if (!choice) return { ok: false, error: "Elegí un método de envío", status: 400 };

  const subtotal = args.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Cupón revalidado: si dejó de ser válido entre que se aplicó y se confirmó, se ignora sin bloquear la compra
  let couponId: string | undefined;
  let couponDiscount = 0;
  let couponFreeShipping = false;
  if (typeof args.couponCode === "string" && args.couponCode) {
    const couponResult = await validateCoupon(args.couponCode, {
      subtotal,
      paymentMethod: args.paymentMethod,
      items: args.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      userId: args.userId,
      customerEmail: args.customerEmail,
    });
    if (couponResult.ok) {
      couponId = couponResult.couponId;
      couponDiscount = couponResult.discountAmount;
      couponFreeShipping = couponResult.freeShipping;
    }
  }

  const shipping = await resolveShipping({
    choice,
    items: args.items.map((i) => ({ quantity: i.quantity, weight: i.weight, width: i.width, height: i.height, length: i.length })),
    subtotal,
    paymentMethodConfigId: args.config.id,
    couponFreeShipping,
  });
  if (!shipping.ok) return { ok: false, error: shipping.error, status: shipping.status };

  const paymentMethodDiscount = await calculatePaymentMethodDiscount(args.items, args.config);
  const productDiscounts = stackDiscounts(subtotal, couponDiscount, shipping.zipDiscount);
  const total = roundMoney(Math.max(0, subtotal - paymentMethodDiscount - productDiscounts) + shipping.cost);

  return {
    ok: true,
    subtotal,
    total,
    couponId,
    couponDiscount,
    zipDiscount: shipping.zipDiscount,
    shippingCost: shipping.cost,
    shippingFields: {
      shippingMethodId: shipping.manualMethodId,
      shippingCost: shipping.cost,
      shippingAddress: shipping.addressText ?? undefined,
      shippingCode: shipping.code,
      shippingName: shipping.name,
      shippingData: shipping.data ? (shipping.data as unknown as Prisma.InputJsonObject) : undefined,
    },
  };
}

export const orderItemMeasures = (item: CheckoutItem) => ({ weight: item.weight, width: item.width, height: item.height, length: item.length });
