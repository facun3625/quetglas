import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redeemReward } from "@/lib/points";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const rewardId = String(body?.rewardId ?? "");
  if (!rewardId) {
    return NextResponse.json({ ok: false, error: "Falta la recompensa" }, { status: 400 });
  }

  const result = await redeemReward(session.user.id, rewardId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
