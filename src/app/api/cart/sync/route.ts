import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isLikelyPhone } from "@/lib/whatsapp";

type SyncBody = {
  sessionId: string;
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
  items: { productId: string; variantId?: string | null; name: string; price: number; quantity: number }[];
  total: number;
};

// Se llama solo, en silencio, tanto en cada cambio del carrito (ver
// lib/cart.tsx, que manda userId/email/name de la sesión si hay una) como
// al tipear en el formulario de checkout (ver CheckoutForm.tsx, que manda
// nombre/email/teléfono aunque el visitante sea anónimo). Un campo ausente
// en el body queda `undefined` y Prisma lo ignora en el update, así que un
// sync no le pisa a otro los datos que ya tenía. Si el carrito quedó vacío
// (lo vació el cliente, o compró y se limpió solo) se borra el registro —
// así nunca queda un carrito "abandonado" que en realidad ya se convirtió
// en venta.
export async function POST(req: Request) {
  const body = (await req.json()) as SyncBody;
  const { sessionId, userId, email, name, phone, items, total } = body;
  const validPhone = typeof phone === "string" && isLikelyPhone(phone) ? phone.trim().slice(0, 40) : undefined;

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
  }

  if (!items || items.length === 0) {
    await prisma.abandonedCart.deleteMany({ where: { sessionId } });
    return NextResponse.json({ ok: true });
  }

  let validUserId: string | undefined;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (user) validUserId = user.id;
  }

  // Hito del embudo: esta sesión armó un carrito (una sola vez por sesión)
  await prisma.funnelEvent.createMany({ data: [{ sessionId, type: "cart" }], skipDuplicates: true }).catch(() => undefined);

  await prisma.abandonedCart.upsert({
    where: { sessionId },
    create: { sessionId, userId: validUserId, email, name, phone: validPhone, items, total },
    update: { userId: validUserId, email, name, phone: validPhone, items, total },
  });

  return NextResponse.json({ ok: true });
}
