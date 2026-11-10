import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago";
import { reconcilePaymentById } from "@/lib/mpReconcile";

// Notificaciones (webhooks) de Mercado Pago. URL a cargar en el panel de MP:
//   <sitio>/api/webhooks/mercadopago      (evento: "Pagos")
// El estado real del pago SIEMPRE se consulta a la API de MP con nuestro token: lo que llega
// acá solo avisa que algo cambió, así que una notificación falsa no puede confirmar nada.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; action?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true, ignored: true });

  const config = await prisma.paymentMethodConfig.findUnique({ where: { method: "mercadopago" } });
  if (!config?.mpAccessToken) return NextResponse.json({ ok: true, ignored: true });

  // Si el admin cargó la clave secreta, la firma es obligatoria
  if (config.mpWebhookSecret) {
    const valid = verifyMercadoPagoSignature({
      secret: config.mpWebhookSecret,
      signatureHeader: req.headers.get("x-signature"),
      requestId: req.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id") ?? dataId,
    });
    if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  try {
    const result = await reconcilePaymentById(dataId, config.mpAccessToken);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("MP webhook failed", dataId, err);
    // 500 => Mercado Pago reintenta la notificación más tarde
    return NextResponse.json({ error: "No se pudo procesar" }, { status: 500 });
  }
}

// MP también verifica la URL con un GET/HEAD
export const GET = () => NextResponse.json({ ok: true });
