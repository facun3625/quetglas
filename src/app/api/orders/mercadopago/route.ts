import { createHash } from "node:crypto";
import { getCheckoutItems } from "@/lib/checkout";
import { InvalidCheckoutError } from "@/lib/checkoutItems";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkStock, cancelOrder, createOrderWithStockGuard, InsufficientStockError, saveUserPhone } from "@/lib/stock";
import { getStoreSettingsRow } from "@/lib/settings";
import { priceOrder, orderItemMeasures } from "@/lib/orderPricing";
import { contactFromCustomer } from "@/lib/orderCustomer";
import { addOrderEvent, finalizeOrder } from "@/lib/orderFlow";
import type { OrderCustomer } from "@/lib/orderCustomer";
import {
  createMercadoPagoPayment,
  refundMercadoPagoPayment,
  type MercadoPagoIdentification,
} from "@/lib/mercadopago";
import { auth } from "@/lib/auth";

import { storeNameOf } from "@/lib/storeName";
// El pedido y su reserva se guardan antes de cobrar. Solo una aprobación
// confirma la compra y dispara los avisos. Un resultado
// incierto conserva el pedido pendiente para que el equipo concilie el pago.

type MercadoPagoOrderBody = {
  checkoutId?: string;
  items: unknown;
  customer: OrderCustomer;
  shipping?: unknown;
  couponCode?: string;
  mpToken: string;
  mpPaymentMethodId: string;
  mpIssuerId?: string;
  mpInstallments?: number;
  mpIdentification: MercadoPagoIdentification;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as MercadoPagoOrderBody | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const {
    items: rawItems,
    customer,
    shipping: shippingChoice,
    couponCode,
    mpToken,
    mpPaymentMethodId,
    mpIssuerId,
    mpInstallments,
    mpIdentification,
  } = body;

  if (!Array.isArray(rawItems) || !rawItems.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (!mpToken || !mpPaymentMethodId) {
    return NextResponse.json({ error: "Faltan datos de la tarjeta" }, { status: 400 });
  }
  if (!mpIdentification?.number) {
    return NextResponse.json({ error: "Falta el DNI del titular" }, { status: 400 });
  }

  if (body.checkoutId !== undefined &&
      (typeof body.checkoutId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.checkoutId))) {
    return NextResponse.json({ error: "Identificador de compra inválido" }, { status: 400 });
  }
  const orderId = createHash("sha256").update("checkout:" + (body.checkoutId ?? "mercadopago:" + mpToken)).digest("hex").slice(0, 36);
  const reviewResponse = () => NextResponse.json({
    orderId,
    requiresReview: true,
    error: `El pago de tu pedido está pendiente de verificación. Contactá a la tienda antes de volver a pagar.`,
  }, { status: 409 });

  try {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) {
      if (existing.status === "confirmed" || existing.status === "delivered") {
        return NextResponse.json({ orderId }, { status: 201 });
      }
      if (existing.status === "cancelled") {
        return NextResponse.json({ resetAttempt: true, error: "Este intento fue cancelado. Podés iniciar otra compra." }, { status: 400 });
      }
      return reviewResponse();
    }
    const items = await getCheckoutItems(rawItems);
    const config = await prisma.paymentMethodConfig.findUnique({
      where: { method: "mercadopago" },
      include: { categoryDiscounts: true },
    });
    if (!config?.enabled) {
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }
    if (!config.mpAccessToken) {
      console.error("Mercado Pago habilitado sin access token configurado");
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }

    // Chequeo rápido antes de cobrar: si ya sabemos que no hay stock, ni
    // intentamos el cobro (evita cobrarle a alguien por algo que no hay).
    const stock = await checkStock(
      items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      new Map(items.map((i) => [i.variantId ?? i.productId, i.name]))
    );
    if (!stock.ok) {
      return NextResponse.json(
        { error: "No hay stock suficiente para algunos productos", shortages: stock.shortages },
        { status: 409 }
      );
    }

    const session = await auth();

    // Envío, cupón y descuentos se calculan acá, en el servidor (el envío de OCA se vuelve a cotizar)
    const priced = await priceOrder({
      items,
      config,
      paymentMethod: "mercadopago",
      shipping: shippingChoice,
      couponCode,
      userId: session?.user?.id,
      customerEmail: customer.email,
    });
    if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status });
    const total = priced.total;
    const storeSettings = await getStoreSettingsRow();
    const { currency } = storeSettings;

    // Persist the order and reserve stock before making any charge. Its ID
    // is also the provider reference, so an uncertain payment can be reconciled.
    let order;
    try {
      order = await createOrderWithStockGuard(
        items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, name: i.name })),
        async (tx) => {
          await saveUserPhone(tx, session?.user?.id, customer.phone);
          return tx.order.create({
            data: {
              id: orderId,
              userId: session?.user?.id,
              customerName: customer.name,
              customerEmail: customer.email,
              customerPhone: customer.phone,
              subtotal: priced.subtotal,
              total: priced.total,
              status: "pending",
              paymentMethod: "mercadopago",
              ...priced.shippingFields,
              ...contactFromCustomer(customer),
              zipDiscount: priced.zipDiscount,
              couponId: priced.couponId,
              couponDiscount: priced.couponDiscount,
              currency,
              stockDeductedAt: new Date(),
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  sku: item.sku,
                  name: item.name,
                  price: item.price,
                  quantity: item.quantity,
                  ...orderItemMeasures(item),
                })),
              },
            },
          });
        }
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json({ error: "No hay stock suficiente para algunos productos", shortages: err.shortages }, { status: 409 });
      }
      // Concurrent retries may race on the unique order ID. Only the request
      // that created the order is allowed to call the payment provider.
      if (await prisma.order.findUnique({ where: { id: orderId } })) return reviewResponse();
      throw err;
    }

    const charge = await createMercadoPagoPayment({
      accessToken: config.mpAccessToken,
      token: mpToken,
      paymentMethodId: mpPaymentMethodId,
      issuerId: mpIssuerId,
      installments: mpInstallments && mpInstallments > 0 ? mpInstallments : 1,
      amount: total,
      description: `Pedido ${storeNameOf(storeSettings)} — ${customer.email}`,
      customerEmail: customer.email,
      identification: mpIdentification,
      externalReference: orderId,
    });

    if (!charge.ok) {
      console.error("Payment was not approved for order", orderId, charge.detail);
      if (!charge.rejected) return reviewResponse();
      await cancelOrder(orderId);
      await addOrderEvent(orderId, "payment", "Pago rechazado: pedido cancelado y stock repuesto.", "Mercado Pago");
      return NextResponse.json({ error: charge.error }, { status: 402 });
    }

    try {
      order = await prisma.order.update({
        where: { id: orderId, status: "pending" },
        data: { status: "confirmed", mercadopagoPaymentId: charge.id },
      });
    } catch (err) {
      const refund = await refundMercadoPagoPayment({
        accessToken: config.mpAccessToken,
        paymentId: charge.id,
      });
      console.error("Could not confirm paid order", orderId, charge.id, err);
      if (!refund.ok) {
        console.error("Refund pending for order", orderId, charge.id, refund.error);
        return reviewResponse();
      }
      await cancelOrder(orderId, { mercadopagoPaymentId: charge.id });
      return NextResponse.json({ resetAttempt: true, error: "No se pudo confirmar el pedido. El cobro se reembolsó." }, { status: 409 });
    }

    await addOrderEvent(order.id, "payment", `Pago aprobado (Mercado Pago #${charge.id}): pedido confirmado.`, "Mercado Pago");
    await finalizeOrder(order.id); // cupón + avisos, una sola vez (idempotente)

    return NextResponse.json({ orderId: order.id, mercadopagoPaymentId: charge.id }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidCheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/orders/mercadopago failed", err);
    try {
      const persisted = await prisma.order.findUnique({ where: { id: orderId } });
      if (persisted?.status === "pending") return reviewResponse();
    } catch { return reviewResponse(); }
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
