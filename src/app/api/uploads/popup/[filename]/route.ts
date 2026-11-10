import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Mismo motivo que las imágenes del hero/mail (ver esas rutas hermanas):
// esta versión de Next no sirve archivos escritos en /public después de que
// el proceso arrancó, así que se leen del disco en cada request.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "popup");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 });
  }

  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "Tipo de archivo no soportado" }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const bytes = await readFile(filePath);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
