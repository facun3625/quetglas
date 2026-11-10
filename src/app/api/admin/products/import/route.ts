import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { ImportInputError, previewImport, startImport } from "@/lib/productImport/jobs";

// Importación de productos desde Excel. Va por ruta de API (no Server Action) porque el ZIP de imágenes
// puede pesar bastante más que el límite de las acciones.
//   POST multipart { file: .xlsx, zip?: .zip, mode: "preview" | "start" }

export const maxDuration = 300;

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los archivos subidos." }, { status: 400 });
  }
  const file = form.get("file");
  const zip = form.get("zip");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Elegí el archivo Excel." }, { status: 400 });
  const zipFile = zip instanceof File && zip.size > 0 ? zip : null;

  try {
    if (form.get("mode") === "start") {
      const jobId = await startImport(file, zipFile, session.user?.id ?? null);
      await logAdminAction("product.import", { targetType: "import", targetId: jobId, detail: file.name });
      try {
        revalidatePath("/admin/productos");
      } catch {}
      return NextResponse.json({ jobId });
    }
    return NextResponse.json({ analysis: await previewImport(file, zipFile) });
  } catch (err) {
    if (err instanceof ImportInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("product import failed", err);
    return NextResponse.json({ error: "No se pudo procesar el archivo." }, { status: 500 });
  }
}
