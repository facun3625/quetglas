import { prisma } from "@/lib/prisma";
import { buildPlan, checkPlan, readSheet, type Issue, type Summary } from "./parse";
import { loadExisting, readZip, runImport, type ZipFiles } from "./run";

// Las importaciones corren en el proceso de Node (persistente en producción, ver PM2). El registro va en globalThis
// para sobrevivir al hot-reload en desarrollo. Una sola a la vez.
const running = ((globalThis as unknown as { __importJobs?: Set<string> }).__importJobs ??= new Set<string>());
const STALE_MS = 2 * 60 * 1000;

export const MAX_XLSX_BYTES = 10 * 1024 * 1024;
export const MAX_ZIP_BYTES = 200 * 1024 * 1024;

export class ImportInputError extends Error {}

export type Analysis = {
  summary: Summary;
  issues: Issue[];
  errors: number;
  warnings: number;
  toImport: number;
  sample: { sku: string; name: string; kind: "simple" | "variable" | "variantUpdate"; variants: number }[];
};

async function analyzeFiles(xlsx: File, zipFile: File | null) {
  if (!/\.xlsx$/i.test(xlsx.name)) throw new ImportInputError("El archivo tiene que ser un Excel .xlsx (si lo tenés en .xls o Google Sheets, guardalo/descargalo como .xlsx).");
  if (xlsx.size > MAX_XLSX_BYTES) throw new ImportInputError("El Excel supera los 10 MB.");
  if (zipFile && !/\.zip$/i.test(zipFile.name)) throw new ImportInputError("Las imágenes tienen que venir en un archivo .zip.");
  if (zipFile && zipFile.size > MAX_ZIP_BYTES) throw new ImportInputError("El ZIP de imágenes supera los 200 MB: dividilo en varias importaciones.");

  let sheet;
  try {
    sheet = await readSheet(await xlsx.arrayBuffer());
  } catch {
    throw new ImportInputError("No se pudo leer el Excel. ¿Es un .xlsx válido?");
  }
  if (!sheet.rows.length) throw new ImportInputError("El Excel no tiene filas con datos debajo de los encabezados.");

  let zip: ZipFiles | null = null;
  if (zipFile) {
    try {
      zip = await readZip(await zipFile.arrayBuffer());
    } catch {
      throw new ImportInputError("No se pudo abrir el ZIP de imágenes.");
    }
  }
  const checked = checkPlan(buildPlan(sheet), await loadExisting(), zip ? new Set(zip.keys()) : null);
  const analysis: Analysis = {
    summary: checked.summary,
    issues: checked.issues.slice(0, 300),
    errors: checked.issues.filter((i) => i.level === "error").length,
    warnings: checked.issues.filter((i) => i.level === "warning").length,
    toImport: checked.products.length,
    sample: checked.products.slice(0, 8).map((p) => ({ sku: p.sku, name: p.name ?? "", kind: p.kind, variants: p.kind === "variable" ? p.variants.length : 0 })),
  };
  return { analysis, products: checked.products, issues: checked.issues, zip };
}

export async function previewImport(xlsx: File, zip: File | null): Promise<Analysis> {
  return (await analyzeFiles(xlsx, zip)).analysis;
}

export async function startImport(xlsx: File, zipFile: File | null, userId: string | null): Promise<string> {
  if (running.size > 0) throw new ImportInputError("Ya hay una importación en curso. Esperá a que termine o cancelala.");
  const { products, issues, zip } = await analyzeFiles(xlsx, zipFile);
  if (!products.length) throw new ImportInputError("No hay ningún producto válido para importar: revisá los errores de la vista previa.");
  const job = await prisma.importJob.create({ data: { fileName: xlsx.name.slice(0, 200), createdById: userId } });
  running.add(job.id);
  // En segundo plano: la respuesta HTTP no espera. El progreso se consulta con getImportJob.
  void runImport(job.id, products, issues, zip)
    .catch((err) => console.error("runImport crashed", job.id, err))
    .finally(() => running.delete(job.id));
  return job.id;
}

export async function getImportJob(id: string) {
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) return null;
  // Si el servidor se reinició a mitad de camino, quedó "running" sin proceso detrás.
  if (job.status === "running" && !running.has(id) && Date.now() - job.updatedAt.getTime() > STALE_MS) {
    const issues = Array.isArray(job.issues) ? job.issues : [];
    return prisma.importJob.update({
      where: { id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        issues: [...issues, { level: "error", row: null, message: "Se interrumpió (reinicio del servidor). Volvé a importar el mismo archivo: sigue sin duplicar." }],
      },
    });
  }
  return job;
}

export async function latestImportJobs(limit = 5) {
  return prisma.importJob.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, fileName: true, status: true, counters: true, createdAt: true, finishedAt: true } });
}

export async function cancelImport(id: string) {
  await prisma.importJob.updateMany({ where: { id, status: "running" }, data: { cancelRequested: true } });
}
