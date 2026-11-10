import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { storeImage } from "@/lib/storage";

const MAX_BYTES = 15 * 1024 * 1024;

// Sube una imagen del catálogo (multipart, campo "file") y devuelve sus URLs.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen supera los 15 MB" }, { status: 413 });

  try {
    return NextResponse.json(await storeImage(Buffer.from(await file.arrayBuffer())), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo subir" }, { status: 400 });
  }
}
