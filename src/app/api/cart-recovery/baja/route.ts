import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOptOut } from "@/lib/cartRecoveryMail";

export const dynamic = "force-dynamic";

const page = (title: string, text: string, status = 200) =>
  new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#fff;color:#383e45;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;">` +
      `<div style="max-width:420px;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 20px">${text}</p>` +
      `<a href="/" style="color:#c4161a;font-weight:600;text-decoration:none">Ir a la tienda</a></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );

// Link de baja de los mails de recuperación de carrito: el email viaja firmado, así que
// nadie puede dar de baja a otra persona. Anotar dos veces el mismo email no hace nada.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  if (!verifyOptOut(email, url.searchParams.get("s") ?? "")) return page("Link no válido", "Este link no es válido o está incompleto.", 400);
  await prisma.cartRecoveryOptOut.upsert({ where: { email }, create: { email }, update: {} });
  return page("Listo, no te vamos a escribir más", "No vas a recibir más recordatorios de carrito en este mail.");
}
