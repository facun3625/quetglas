import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { ocaLabelPdf, OcaError } from "@/lib/oca/client";

// Rótulo PDF de OCA para pegar en el paquete. Solo el panel de administración.
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (!orderId) return new Response("Falta el pedido", { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { number: true, trackingNumber: true, trackingCarrier: true } });
  if (!order?.trackingNumber || order.trackingCarrier !== "OCA") return new Response("Este pedido todavía no está registrado en OCA", { status: 404 });
  try {
    const pdf = await ocaLabelPdf(order.trackingNumber);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="rotulo-oca-${order.number}.pdf"`, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(err instanceof OcaError ? err.message : "No se pudo obtener el rótulo", { status: 502 });
  }
}
