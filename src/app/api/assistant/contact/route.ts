import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseContactRequest } from "@/lib/ai/validation";

export const dynamic = "force-dynamic";

// Un mismo visitante no necesita guardar sus datos más de unas pocas veces por minuto
const WINDOW_MS = 60_000;
const LIMIT = 10;
const windows = new Map<string, { startedAt: number; count: number }>();

function limited(key: string, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    windows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (windows.size > 5_000) for (const [k, w] of windows) if (now - w.startedAt >= WINDOW_MS) windows.delete(k);
  return current.count > LIMIT;
}

// Guarda el nombre y el teléfono que el cliente dejó al abrir el chat de la vendedora virtual, en su conversación.
export async function POST(request: NextRequest) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (limited(`ip:${address}`)) return NextResponse.json({ error: "Probá de nuevo en un momento." }, { status: 429 });
  if (Number(request.headers.get("content-length") || 0) > 4_000) return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });

  let parsed: { sessionId: string; name: string; phone: string };
  try {
    parsed = parseContactRequest(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Solicitud inválida" }, { status: 400 });
  }

  const session = await auth();
  await prisma.aiConversation.upsert({
    where: { sessionId: parsed.sessionId },
    create: { sessionId: parsed.sessionId, userId: session?.user?.id, name: parsed.name, phone: parsed.phone },
    update: { name: parsed.name, phone: parsed.phone, ...(session?.user?.id ? { userId: session.user.id } : {}) },
  });
  return NextResponse.json({ ok: true });
}
