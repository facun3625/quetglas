import Link from "next/link";
import { CsvImportForm } from "./CsvImportForm";

export default function ImportPricesPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/admin/productos" className="text-xs text-brand-muted hover:text-brand-pink-dark">← Productos</Link>
      <h1 className="mt-2 text-2xl font-bold text-brand-ink">Precios y stock por CSV</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Descargá el catálogo, editá precios o stock en Excel o Google Sheets y volvé a subirlo. Se actualiza por
        <b> SKU</b> (de productos simples y de variantes); las demás columnas se ignoran.
      </p>

      <a href="/api/admin/products/export" className="mt-5 inline-block rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">
        Descargar productos.csv
      </a>

      <div className="mt-6 rounded-xl border border-black/10 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-brand-ink">Subir CSV editado</p>
        <p className="mb-3 text-xs text-brand-muted">Columnas: <code>sku</code> y al menos una de <code>precio</code>, <code>precio_anterior</code>, <code>stock</code>. Las celdas vacías no se modifican.</p>
        <CsvImportForm />
      </div>
    </div>
  );
}
