import { NextResponse } from "next/server";
import { parseIconName, renderAppIcon } from "@/lib/appIcon";

export const dynamic = "force-dynamic";

// /icons/app/192.png, /icons/app/512.png y /icons/app/512-maskable.png: los íconos de la app instalada
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const spec = parseIconName((await params).name);
  if (!spec) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const png = await renderAppIcon(spec);
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}
