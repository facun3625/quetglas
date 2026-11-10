import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/points";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const settings = await getStoreSettings();
  if (!settings.pointsEnabled) {
    return NextResponse.json({ pointsEnabled: false });
  }

  const [user, rewards, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { points: true } }),
    prisma.pointReward.findMany({ where: { enabled: true }, orderBy: { pointsRequired: "asc" } }),
    prisma.pointTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    pointsEnabled: true,
    points: user?.points ?? 0,
    rewards,
    transactions,
  });
}
