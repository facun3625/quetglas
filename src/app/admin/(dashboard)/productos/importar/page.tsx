import Link from "next/link";
import { CsvImportForm } from "./CsvImportForm";
import { ExcelImport } from "./ExcelImport";

export default function ImportProductsPage() {
  return (
    <div className="max-w-4xl">
      <Link href="/admin/productos" className="text-xs text-brand-muted hover:text-brand-pink-dark">← Productos</Link>
      <h1 className="mt-2 text-2xl font-bold text-brand-ink">Importar productos desde Excel</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Carga productos nuevos y actualiza los existentes. Cada producto se busca por <b>SKU</b>: si existe se actualiza, si no se crea.
        Primero se muestra una vista previa con los errores; no se guarda nada hasta que confirmes.
      </p>

      <div className="mt-5 rounded-xl border border-black/10 bg-brand-soft p-5 text-sm text-brand-ink">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">Usá la plantilla</p>
          <a href="/descargas/plantilla-productos.xlsx" download className="rounded-lg border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-white/70">
            Descargar plantilla .xlsx
          </a>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-brand-muted">
          <li><b>Una fila por producto.</b> Si tiene variantes (talle, tamaño, color…), una fila por variante con el mismo valor en la columna <code>grupo</code>.</li>
          <li><b>Atributos:</b> columnas <code>atributo:Tamaño</code>, <code>atributo:Color</code>, etc. Agregá solo las que uses; si no hay ninguna, se cargan productos simples.</li>
          <li><b>Imágenes:</b> links públicos (https://…) o nombres de archivo que subís en un .zip. Varias separadas con <code>|</code>; la primera es la principal.</li>
          <li><b>Categorías:</b> como ruta, <code>Dermocosmética &gt; Protección solar</code>. Las que no existen se crean.</li>
          <li><b>Al actualizar, una celda vacía no borra nada:</b> podés subir un Excel solo con <code>sku</code> y <code>precio</code> para cambiar precios.</li>
          <li>Las variantes que ya están cargadas y no aparecen en el Excel no se tocan.</li>
        </ul>
      </div>

      <div className="mt-5">
        <ExcelImport />
      </div>

      <details className="mt-8 rounded-xl border border-black/10 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-brand-ink">Precios y stock por CSV (método anterior)</summary>
        <p className="mt-3 text-sm text-brand-muted">
          Descargá el catálogo, editá precios o stock y volvé a subirlo. Se actualiza por <b>SKU</b>; las demás columnas se ignoran.
        </p>
        <a href="/api/admin/products/export" className="mt-3 inline-block rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-soft">
          Descargar productos.csv
        </a>
        <p className="mt-4 mb-3 text-xs text-brand-muted">Columnas: <code>sku</code> y al menos una de <code>precio</code>, <code>precio_anterior</code>, <code>stock</code>. Las celdas vacías no se modifican.</p>
        <CsvImportForm />
      </details>
    </div>
  );
}
