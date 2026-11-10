import { prisma } from "@/lib/prisma";
import { createWooClient, type WooCredentials, WooError } from "./client";
import { runMigration, type MigrationOptions } from "./migrate";
import type { WooProduct } from "./types";

// Las corridas viven en el proceso de Node (que en producción es persistente, ver
// PM2). El registro va en globalThis para sobrevivir al hot-reload en desarrollo.
const running = ((globalThis as unknown as { __wooJobs?: Set<string> }).__wooJobs ??= new Set<string>());
const STALE_MS = 2 * 60 * 1000;

export type WooPreview = {
  storeUrl: string;
  products: number;
  categories: number;
  attributes: number;
  customers: number | null; // null = la clave no tiene permiso para leer clientes
  sample: string[];
};

export async function previewWoo(creds: WooCredentials): Promise<WooPreview> {
  const client = createWooClient(creds);
  const [products, categories, attributes] = await Promise.all([
    client.get<WooProduct[]>("products", { per_page: 5, status: "any" }),
    client.get<unknown[]>("products/categories", { per_page: 1 }),
    client.get<unknown[]>("products/attributes"),
  ]);
  let customers: number | null = null;
  try {
    customers = (await client.get<unknown[]>("customers", { per_page: 1, role: "all" })).total;
  } catch (err) {
    if (!(err instanceof WooError)) throw err;
  }
  return {
    storeUrl: client.baseUrl,
    products: products.total,
    categories: categories.total,
    attributes: attributes.data.length,
    customers,
    sample: products.data.map((p) => p.name),
  };
}

export async function startMigration(creds: WooCredentials, options: MigrationOptions): Promise<string> {
  if (running.size > 0) throw new WooError("Ya hay una migración en curso. Esperá a que termine o cancelala.");
  const client = createWooClient(creds);
  await client.get("products", { per_page: 1 }); // valida URL y claves antes de crear el trabajo

  const job = await prisma.migrationJob.create({ data: { sourceUrl: client.baseUrl, options } });
  running.add(job.id);
  // En segundo plano: la respuesta HTTP no espera. El progreso se consulta con getJob.
  void runMigration(job.id, client, options)
    .catch((err) => console.error("runMigration crashed", job.id, err))
    .finally(() => running.delete(job.id));
  return job.id;
}

export async function getJob(id: string) {
  const job = await prisma.migrationJob.findUnique({ where: { id } });
  if (!job) return null;
  // Si el servidor se reinició a mitad de camino, el trabajo quedó "running" sin proceso detrás.
  if (job.status === "running" && !running.has(id) && Date.now() - job.updatedAt.getTime() > STALE_MS) {
    const issues = Array.isArray(job.issues) ? job.issues : [];
    return prisma.migrationJob.update({
      where: { id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        issues: [...issues, { level: "error", entity: "migración", ref: "general", message: "Se interrumpió (reinicio del servidor). Volvé a ejecutarla: continúa sin duplicar." }],
      },
    });
  }
  return job;
}

export async function requestCancel(id: string) {
  await prisma.migrationJob.updateMany({ where: { id, status: "running" }, data: { cancelRequested: true } });
}

export const hasRunningJob = () => running.size > 0;
