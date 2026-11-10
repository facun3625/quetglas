import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/webPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = await getVapidPublicKey();
    return NextResponse.json(
      { publicKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET /api/push/public-key failed", error);
    return NextResponse.json({ error: "No se pudo iniciar las notificaciones" }, { status: 503 });
  }
}
