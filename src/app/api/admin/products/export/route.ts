import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

// Una fila por producto simple y una por cada variante. Columna "tipo": simple | variante.
export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: { variants: { orderBy: { createdAt: "asc" }, include: { terms: { include: { term: true } } } } },
  });
  const rows: (string | number | null)[][] = [["tipo", "sku", "nombre", "precio", "precio_anterior", "stock"]];
  for (const p of products) {
    if (p.type === "simple") rows.push(["simple", p.sku, p.name, p.price, p.compareAtPrice, p.stock]);
    else {
      for (const v of p.variants) {
        rows.push(["variante", v.sku, `${p.name} — ${v.terms.map((t) => t.term.name).join(" / ")}`, v.price, v.compareAtPrice, v.stock]);
      }
    }
  }
  return new Response(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="productos.csv"' },
  });
}
