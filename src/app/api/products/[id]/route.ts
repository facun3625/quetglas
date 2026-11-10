import { NextResponse } from "next/server";
import { getProductDetail } from "@/lib/productDetail";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const product = await getProductDetail({ id });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (err) {
    console.error(`GET /api/products/${id} failed`, err);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 502 });
  }
}
