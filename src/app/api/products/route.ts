import { NextRequest, NextResponse } from "next/server";
import { getProductsPage } from "@/lib/products";

export async function GET(req: NextRequest) {
  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;
  const query = req.nextUrl.searchParams.get("q") ?? undefined;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 24) || 24, 1), 100);
  const offset = Math.max(Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0, 0);

  try {
    const { products, total } = await getProductsPage({ categoryId, query, limit, offset });
    return NextResponse.json({ products, total, limit, offset });
  } catch (err) {
    console.error("GET /api/products failed", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 502 });
  }
}
