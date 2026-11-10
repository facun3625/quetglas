import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { MAX_VIDEO_BYTES, storeVideo } from "@/lib/storage";

// Sube un video de portada (multipart, campo "file"): mp4 o webm, hasta 50 MB. Devuelve su URL.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  if (file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "El video supera los 50 MB: comprimilo o usá un enlace" }, { status: 413 });
  try {
    return NextResponse.json(await storeVideo(Buffer.from(await file.arrayBuffer())), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo subir" }, { status: 400 });
  }
}
