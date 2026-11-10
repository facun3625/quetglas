import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Para monitoreo externo (UptimeRobot, Better Stack, etc.): responde 200 si la app y la base
// están bien y 503 si no. No expone datos de la tienda.
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - startedAt, uptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    console.error("health check failed", err);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
