import { readFile } from "node:fs/promises";
import path from "node:path";

// Manual de uso: HTML autocontenido (con las capturas embebidas en base64) generado aparte (docs/manual/build-manual.py), no
// una página React común. Tiene dos partes: el panel de administración y lo que hace el comprador en la tienda.
// A propósito SIN login: se comparte también con franquicias potenciales como material de venta/onboarding. El link no está
// listado en ningún menú del sitio y lleva noindex — no es secreto por contraseña, es "no lo vas a encontrar salvo que te
// pasen el link". El manual anterior de Cortopassi sigue disponible en /manual/anterior.
const MANUAL_PATH = path.join(process.cwd(), "src", "content", "manual-tienda-modelo.html");

export async function GET() {
  const html = await readFile(MANUAL_PATH, "utf-8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
