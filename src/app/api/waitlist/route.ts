import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  const { productId, productName, categoryName, name, phone, email } = body as {
    productId?: string;
    productName?: string;
    categoryName?: string;
    name?: string;
    phone?: string;
    email?: string;
  };

  if (!productId || !productName || !name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
  }

  await prisma.waitlistEntry.upsert({
    where: { productId_email: { productId, email: email.trim() } },
    create: {
      productId,
      productName,
      categoryName,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email.trim(),
    },
    update: { name: name.trim(), phone: phone?.trim() || null },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
