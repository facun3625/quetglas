import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/shippingFlow";

// Direcciones guardadas del cliente (solo las suyas)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([]);
  const addresses = await prisma.address.findMany({ where: { userId: session.user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  return NextResponse.json(addresses);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Iniciá sesión para guardar direcciones" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { address?: Record<string, string>; phone?: string; isDefault?: boolean } | null;
  const checked = normalizeAddress(body?.address);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const a = checked.address;
  const userId = session.user.id;

  const existing = await prisma.address.findFirst({ where: { userId, street: a.street, number: a.number, zipCode: a.zipCode, apartment: a.apartment || null } });
  if (existing) return NextResponse.json(existing);
  const count = await prisma.address.count({ where: { userId } });
  if (count >= 10) return NextResponse.json({ error: "Podés guardar hasta 10 direcciones. Borrá alguna para agregar otra." }, { status: 400 });

  const makeDefault = Boolean(body?.isDefault) || count === 0;
  const created = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({
      data: { userId, street: a.street, number: a.number, apartment: a.apartment || null, city: a.city, province: a.province, zipCode: a.zipCode, phone: body?.phone?.trim().slice(0, 30) || null, isDefault: makeDefault },
    });
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la dirección" }, { status: 400 });
  const removed = await prisma.address.deleteMany({ where: { id, userId: session.user.id } });
  if (removed.count === 0) return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Marcar una dirección como la predeterminada
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta la dirección" }, { status: 400 });
  const userId = session.user.id;
  const found = await prisma.address.findFirst({ where: { id, userId }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
