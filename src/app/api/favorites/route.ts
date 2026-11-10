import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ productIds: [] });

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    select: { productId: true },
  });
  return NextResponse.json({ productIds: favorites.map((f) => f.productId) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { productId } = (await req.json()) as { productId?: string };
  if (!productId) return NextResponse.json({ error: "Falta productId" }, { status: 400 });

  await prisma.favorite.upsert({
    where: { userId_productId: { userId: session.user.id, productId } },
    create: { userId: session.user.id, productId },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { productId } = (await req.json()) as { productId?: string };
  if (!productId) return NextResponse.json({ error: "Falta productId" }, { status: 400 });

  await prisma.favorite.deleteMany({ where: { userId: session.user.id, productId } });
  return NextResponse.json({ ok: true });
}
