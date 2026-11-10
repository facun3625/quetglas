import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { buildAssistantInstructions } from "@/lib/ai/prompt";
import { runAssistantProvider } from "@/lib/ai/provider";
import { DEFAULT_AI_MODELS } from "@/lib/ai/types";
import { parseAssistantRequest, parseAssistantSessionId } from "@/lib/ai/validation";
import { addUsage, isAiQuotaExhausted } from "@/lib/usage";

export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;
const rateWindows = new Map<string, { startedAt: number; count: number }>();

function isRateLimited(key: string, limit: number, now = Date.now()): boolean {
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (rateWindows.size > 5_000) {
    for (const [storedKey, window] of rateWindows) {
      if (now - window.startedAt >= RATE_WINDOW_MS) rateWindows.delete(storedKey);
    }
  }
  return current.count > limit;
}

function requestAddress(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export async function POST(request: NextRequest) {
  const address = requestAddress(request);
  if (isRateLimited(`ip:${address}`, 30)) {
    return NextResponse.json(
      { error: "Mandaste varios mensajes seguidos. Esperá un momento y volvé a intentar." },
      { status: 429 },
    );
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_000) {
    return NextResponse.json({ error: "La solicitud es demasiado grande." }, { status: 413 });
  }

  let parsed: { sessionId: string; message: string };
  try {
    parsed = parseAssistantRequest(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Solicitud inválida";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (isRateLimited(`session:${parsed.sessionId}`, RATE_LIMIT)) {
    return NextResponse.json(
      { error: "Mandaste varios mensajes seguidos. Esperá un momento y volvé a intentar." },
      { status: 429 },
    );
  }

  const settings = await getStoreSettingsRow();
  if (!settings.aiAssistantEnabled || !settings.aiProvider || !settings.aiApiKey) {
    return NextResponse.json({ error: "La vendedora virtual no está disponible." }, { status: 503 });
  }

  // Cupo mensual de tokens agotado: la vendedora se apaga hasta el mes siguiente (la tienda ofrece WhatsApp en su lugar)
  if (await isAiQuotaExhausted()) {
    return NextResponse.json({ error: "La vendedora virtual no está disponible por ahora.", unavailable: true }, { status: 503 });
  }

  const existing = await prisma.aiConversation.findUnique({
    where: { sessionId: parsed.sessionId },
    select: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { role: true, content: true },
      },
    },
  });
  const history = [
    ...(existing?.messages ?? []).reverse().map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: parsed.message },
  ];

  try {
    const reply = await runAssistantProvider(settings.aiProvider, {
      apiKey: settings.aiApiKey,
      model: settings.aiModel || DEFAULT_AI_MODELS[settings.aiProvider],
      instructions: buildAssistantInstructions(settings.aiInstructions),
      history,
    });
    // Lo consumido se resta del cupo mensual (Configuración → Consumo)
    await Promise.all([addUsage("ai_tokens", reply.tokens), addUsage("ai_requests", 1)]).catch((err) => console.error("usage: no se pudo contar el consumo de IA", err));
    const cleanReply = reply.text.trim().slice(0, 5_000);
    const session = await auth();
    const conversation = await prisma.aiConversation.upsert({
      where: { sessionId: parsed.sessionId },
      create: { sessionId: parsed.sessionId, userId: session?.user?.id },
      // lastMessageAt ordena la lista de Conversaciones IA del panel; handledAt vuelve a null: hay algo nuevo para revisar
      update: { lastMessageAt: new Date(), handledAt: null, ...(session?.user?.id ? { userId: session.user.id } : {}) },
      select: { id: true },
    });
    await prisma.aiMessage.createMany({
      data: [
        { conversationId: conversation.id, role: "user", content: parsed.message },
        {
          conversationId: conversation.id,
          role: "assistant",
          content: cleanReply,
          productIds: reply.products.map((product) => product.id),
        },
      ],
    });

    return NextResponse.json({ message: cleanReply, products: reply.products });
  } catch (error) {
    console.error("AI assistant request failed", error);
    return NextResponse.json(
      { error: "No pude responder ahora. Probá nuevamente en un momento." },
      { status: 502 },
    );
  }
}

// "Limpiar chat" solo empieza una conversación nueva en el navegador: las conversaciones quedan guardadas y se ven en el
// panel (Conversaciones IA). Se mantiene el endpoint para navegadores que todavía tengan la versión anterior abierta.
export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}
