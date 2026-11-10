import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const { assistant } = await getSiteSettings();
  return NextResponse.json(assistant, {
    headers: { "Cache-Control": "no-store" },
  });
}
