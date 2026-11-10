import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/passwordReset";

// Respuesta idéntica exista o no la cuenta (no se puede usar para averiguar emails registrados).
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Ingresá un email válido" }, { status: 400 });
  }
  try {
    await requestPasswordReset(email);
  } catch (err) {
    console.error("POST /api/auth/forgot failed", err);
  }
  return NextResponse.json({ ok: true });
}
