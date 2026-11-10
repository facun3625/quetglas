import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

// Sirve las imágenes del slider leyendo el disco en cada request, en vez de
// depender de que Next.js sirva /public estáticamente: esta versión de Next
// no nota los archivos que se escriben ahí después de que el proceso
// arrancó, y no se vuelven a servir hasta el próximo restart/deploy — mismo
// bug que los comprobantes de transferencia (ver
// ../../comprobantes/[filename]/route.ts), acá para las imágenes del hero.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "hero");

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
