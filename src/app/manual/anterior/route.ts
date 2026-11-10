import { readFile } from "node:fs/promises";
import path from "node:path";

// Manual anterior de Cortopassi (versión previa al manual de dos partes). Se conserva por si hace falta; no está enlazado.
const MANUAL_PATH = path.join(process.cwd(), "src", "content", "manual-cortopassi.html");

export async function GET() {
  const html = await readFile(MANUAL_PATH, "utf-8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
