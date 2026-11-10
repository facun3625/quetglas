import { NextResponse } from "next/server";
import { getAllCategories } from "@/lib/categories";

export async function GET() {
  try {
    return NextResponse.json(await getAllCategories());
  } catch (err) {
    console.error("GET /api/categories failed", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 502 });
  }
}
