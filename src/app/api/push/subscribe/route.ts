import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SubscriptionInput = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

// Se llama al aceptar el permiso de notificaciones (ver "Descargar Web
// App"). Si el usuario está logueado, la suscripción queda atada a su
// cuenta — así se le puede mandar el push de "recibimos tu pedido" junto
// con el mail (lib/orderEmails.ts), a cualquiera de sus dispositivos.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SubscriptionInput | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const authKey = body?.keys?.auth;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
  }

  const session = await auth();

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh, auth: authKey, userId: session?.user?.id },
    // Si ya existía (el browser puede devolver la misma suscripción de
    // nuevo) y ahora hay sesión, aprovechamos para atarla al usuario.
    update: session?.user?.id ? { p256dh, auth: authKey, userId: session.user.id } : { p256dh, auth: authKey },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// Al desactivar notificaciones desde el propio navegador.
export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
  return new NextResponse(null, { status: 204 });
}
