import { NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/passwordReset";

export async function POST(req: Request) {
  const { token, password } = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  if (typeof token !== "string" || !token || typeof password !== "string") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const result = await resetPasswordWithToken(token, password);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 400 });
}
