import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getMailSender } from "@/lib/mailer";
import { buildMailHtml } from "@/lib/mailTemplate";
import { resolveLogos, absoluteUrl } from "@/lib/logo";

import { storeNameOf } from "@/lib/storeName";
// Límite simple por IP en memoria (en un proceso persistente alcanza para frenar el abuso casual)
const hits = ((globalThis as unknown as { __contactHits?: Map<string, number[]> }).__contactHits ??= new Map<string, number[]>());
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  // Campo trampa completado => bot: se responde OK sin guardar nada
  if (typeof body.website === "string" && body.website.trim() !== "") return NextResponse.json({ ok: true });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return NextResponse.json({ error: "Enviaste varios mensajes seguidos. Probá de nuevo en unos minutos." }, { status: 429 });

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(body.name, 100);
  const email = str(body.email, 254);
  const phone = str(body.phone, 40);
  const message = str(body.message, 3000);
  if (!name || !EMAIL.test(email) || message.length < 5) return NextResponse.json({ error: "Completá nombre, un email válido y tu mensaje" }, { status: 400 });

  hits.set(ip, [...recent, now]);
  await prisma.contactMessage.create({ data: { name, email, phone: phone || null, message } });

  // Aviso por mail a la tienda (si hay proveedor de correo y email de contacto)
  try {
    const settings = await getStoreSettingsRow();
    const to = settings.contactEmail?.trim() || settings.mailFromEmail?.trim();
    const sender = await getMailSender();
    if (to && sender) {
      const subject = `Nuevo mensaje de contacto — ${name}`;
      await sender.send(
        to,
        subject,
        buildMailHtml({
          logoUrl: absoluteUrl(resolveLogos(settings).header),
          franchiseName: storeNameOf(settings),
          subject,
          title: "Nuevo mensaje de contacto",
          body: `${name} (${email}${phone ? `, ${phone}` : ""}) escribió:\n\n${message}\n\nPodés verlo en el panel: ${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/admin/mensajes`,
          footer: { siteUrl: process.env.NEXTAUTH_URL },
        })
      );
    }
  } catch (err) {
    console.error("contact mail failed", err);
  }
  return NextResponse.json({ ok: true });
}
