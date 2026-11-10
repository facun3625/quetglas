import { getCheckoutItems } from "@/lib/checkout";
import { InvalidCheckoutError } from "@/lib/checkoutItems";
import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkStock, createOrderWithStockGuard, InsufficientStockError, saveUserPhone } from "@/lib/stock";
import { getStoreSettingsRow } from "@/lib/settings";
import { priceOrder, orderItemMeasures } from "@/lib/orderPricing";
import { contactFromCustomer } from "@/lib/orderCustomer";
import { addOrderEvent, finalizeOrder } from "@/lib/orderFlow";
import type { OrderCustomer } from "@/lib/orderCustomer";

// El pedido queda registrado acá (Prisma es la única fuente de verdad de las
// ventas online). Al COMPRAR se descuenta el stock en la misma transacción que
// crea el pedido (createOrderWithStockGuard); si el pedido se cancela o se
// elimina, el stock se repone (ver lib/stock.ts).

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "comprobantes");



// Esta ruta es para los métodos "instantáneos" (transferencia, contra
// entrega): el pedido queda "pending" hasta que el equipo confirma el pago
// desde el admin. Las tarjetas usan rutas separadas con reserva previa al cobro.
const DIRECT_PAYMENT_METHODS = ["transferencia", "contra_entrega", "sin_pago"] as const;
type DirectPaymentMethod = (typeof DIRECT_PAYMENT_METHODS)[number];

function isDirectPaymentMethod(value: unknown): value is DirectPaymentMethod {
  return typeof value === "string" && (DIRECT_PAYMENT_METHODS as readonly string[]).includes(value);
}

async function saveComprobante(file: File): Promise<string> {
  const ext = (path.extname(file.name) || "").toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);
  // Servido por una ruta propia, no por /public estático — ver
  // src/app/api/uploads/comprobantes/[filename]/route.ts para el porqué.
  return `/api/uploads/comprobantes/${filename}`;
}

export async function POST(req: Request) {
  let form: FormData;
  let rawItems: unknown;
  let customer: OrderCustomer;
  try {
    form = await req.formData();
    rawItems = JSON.parse(String(form.get("items") ?? "[]"));
    customer = JSON.parse(String(form.get("customer") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const checkoutId = form.get("checkoutId");
  if (checkoutId !== null && (typeof checkoutId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(checkoutId))) {
    return NextResponse.json({ error: "Identificador de compra inválido" }, { status: 400 });
  }
  const orderId = typeof checkoutId === "string"
    ? createHash("sha256").update("checkout:" + checkoutId).digest("hex").slice(0, 36)
    : randomUUID();
  const paymentMethod = form.get("paymentMethod");
  const comprobante = form.get("comprobante");
  let shippingChoice: unknown;
  try {
    shippingChoice = JSON.parse(String(form.get("shipping") ?? "null"));
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const couponCode = form.get("couponCode");

  if (!Array.isArray(rawItems) || !rawItems.length) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!customer?.email || !customer?.name || !customer?.phone) {
    return NextResponse.json({ error: "Nombre, email y teléfono son requeridos" }, { status: 400 });
  }
  if (!isDirectPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
  }
  if (paymentMethod === "transferencia" && !(comprobante instanceof File)) {
    return NextResponse.json({ error: "Adjuntá el comprobante de la transferencia" }, { status: 400 });
  }

  try {
    const existing = await prisma.order.findUnique({ where: { id: orderId } });
    if (existing) {
      if (existing.status === "cancelled") {
        return NextResponse.json({ resetAttempt: true, error: "Este intento fue cancelado. Podés iniciar otra compra." }, { status: 400 });
      }
      if (existing.status === "pending" && !isDirectPaymentMethod(existing.paymentMethod)) {
        return NextResponse.json({ orderId, requiresReview: true, error: "El pago anterior está pendiente de verificación. Contactá a la tienda antes de volver a pagar." }, { status: 409 });
      }
      return NextResponse.json({ orderId }, { status: 201 });
    }
    const items = await getCheckoutItems(rawItems);
    const config = await prisma.paymentMethodConfig.findUnique({
      where: { method: paymentMethod },
      include: { categoryDiscounts: true },
    });
    if (!config?.enabled) {
      return NextResponse.json({ error: "Ese método de pago no está disponible" }, { status: 400 });
    }

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
    const { currency } = await getStoreSettingsRow();

    // Envío, cupón y descuentos se calculan acá, en el servidor (el envío de OCA se vuelve a cotizar)
    const priced = await priceOrder({
      items,
      config,
      paymentMethod,
      shipping: shippingChoice,
      couponCode,
      userId: session?.user?.id,
      customerEmail: customer.email,
    });
    if (!priced.ok) return NextResponse.json({ error: priced.error }, { status: priced.status });

    const transferProofUrl =
      paymentMethod === "transferencia" && comprobante instanceof File ? await saveComprobante(comprobante) : undefined;

    // status queda en "pending" (default del schema): el pago todavía no
    // está confirmado para transferencia/contra-entrega, alguien del equipo
    // lo confirma a mano desde el admin cuando llega la plata.
    //
    // El pedido se crea bajo un candado por producto (createOrderWithStockGuard):
    // recién ahí se descuenta el stock,
    // y dos compras simultáneas de la última unidad no pasan las dos.
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
              paymentMethod,
              transferProofUrl,
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
        return NextResponse.json(
          { error: "No hay stock suficiente para algunos productos", shortages: err.shortages },
          { status: 409 }
        );
      }
      throw err;
    }

    await addOrderEvent(order.id, "system", `Pedido creado (${paymentMethod}). Stock descontado.`, "Cliente");
    await finalizeOrder(order.id); // cupón + avisos, una sola vez (idempotente)

    return NextResponse.json({ orderId: order.id }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidCheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/orders failed", err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 502 });
  }
}
