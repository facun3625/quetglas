import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyTraffic } from "@/lib/trafficSource";

type TrackBody = { path?: string; sessionId?: string; landing?: { referrer?: string; search?: string } };

// Registro de visitas del sitio público — nunca debe romper la navegación
// del cliente si falla, por eso siempre contesta 200 y no hace ninguna
// validación estricta más allá de chequear que vinieron los dos campos.
// Si la visita es la llegada de la sesión (trae "landing"), se guarda también de dónde vino.
export async function POST(req: Request) {
  try {
    const { path, sessionId, landing } = (await req.json()) as TrackBody;
    if (!path || !sessionId) return NextResponse.json({ ok: true });

    let source: ReturnType<typeof classifyTraffic> | null = null;
    if (landing && typeof landing === "object") {
      source = classifyTraffic({
        referrer: String(landing.referrer ?? "").slice(0, 300),
        search: String(landing.search ?? "").slice(0, 500),
        userAgent: req.headers.get("user-agent"),
        siteHost: req.headers.get("x-forwarded-host") ?? req.headers.get("host"),
      });
    }

    await prisma.pageView.create({
      data: {
        path: path.slice(0, 200),
        sessionId: sessionId.slice(0, 100),
        ...(source ? { isLanding: true, channel: source.channel, paid: source.paid, campaign: source.campaign, referrerHost: source.referrerHost?.slice(0, 100) ?? null } : {}),
      },
    });
  } catch (err) {
    console.error("POST /api/track failed", err);
  }
  return NextResponse.json({ ok: true });
}
