import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

// Búsqueda liviana de productos para los selectores del panel (recomendados, etc.)
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [] });
  const products = await prisma.product.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] },
    select: { id: true, name: true, sku: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return NextResponse.json({ products });
}
