import path from "node:path";
import { unlink } from "node:fs/promises";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";
import { getR2Config, r2Client } from "@/lib/storage";

// Deshacer la migración desde WooCommerce: borra TODO lo que trajo (productos con sus variantes e imágenes, categorías,
// atributos, etiquetas que quedan sin uso y, si se pide, los clientes migrados) y los archivos de R2 / disco. Solo reconoce
// lo migrado por su wooId: lo que se cargó a mano en la tienda nueva no se toca.

export type UndoPreview = {
  products: number;
  images: number;
  categories: number;
  attributes: number;
  customersDeletable: number;
  customersKept: number;
  orderItemsAffected: number;
  jobs: number;
};

const migratedProduct = { wooId: { not: null } } as const;

export async function previewUndo(): Promise<UndoPreview> {
  const [products, images, categories, attributes, customersDeletable, customersKept, orderItemsAffected, jobs] = await Promise.all([
    prisma.product.count({ where: migratedProduct }),
    prisma.productImage.count({ where: { product: migratedProduct } }),
    prisma.category.count({ where: { wooId: { not: null } } }),
    prisma.attribute.count({ where: { wooId: { not: null } } }),
    prisma.user.count({ where: { wooId: { not: null }, role: "customer", points: 0, orders: { none: {} } } }),
    prisma.user.count({ where: { wooId: { not: null }, OR: [{ role: { not: "customer" } }, { points: { gt: 0 } }, { orders: { some: {} } }] } }),
    prisma.orderItem.count({ where: { product: migratedProduct } }),
    prisma.migrationJob.count(),
  ]);
  return { products, images, categories, attributes, customersDeletable, customersKept, orderItemsAffected, jobs };
}

export type UndoResult = UndoPreview & { filesDeleted: number; filesFailed: number };

// Archivos de imagen (R2 o disco local) a partir de las URLs guardadas
async function deleteFiles(urls: string[]): Promise<{ deleted: number; failed: number }> {
  const unique = [...new Set(urls.filter(Boolean))];
  let deleted = 0;
  let failed = 0;
  const cfg = await getR2Config();
  const r2Keys: string[] = [];
  for (const url of unique) {
    if (cfg && url.startsWith(`${cfg.publicUrl}/`)) {
      r2Keys.push(url.slice(cfg.publicUrl.length + 1));
    } else if (url.startsWith("/api/uploads/products/")) {
      const file = path.basename(url);
      try {
        await unlink(path.join(process.cwd(), "public", "uploads", "products", file));
        deleted++;
      } catch {
        failed++;
      }
    }
    // Cualquier otra URL (por ejemplo una imagen externa) no es nuestra: no se toca
  }
  if (cfg) {
    for (let i = 0; i < r2Keys.length; i += 1000) {
      const batch = r2Keys.slice(i, i + 1000);
      try {
        const res = await r2Client(cfg).send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }));
        const errors = res.Errors?.length ?? 0;
        deleted += batch.length - errors;
        failed += errors;
      } catch {
        failed += batch.length;
      }
    }
  }
  return { deleted, failed };
}

export async function undoMigration(opts: { customers: boolean }): Promise<UndoResult> {
  const preview = await previewUndo();

  // Todo lo que hay que recordar ANTES de borrar
  const [images, categoryImages, attrLinks, tagLinks] = await Promise.all([
    prisma.productImage.findMany({ where: { product: migratedProduct }, select: { url: true, thumbUrl: true } }),
    prisma.category.findMany({ where: { wooId: { not: null }, imageUrl: { not: null } }, select: { imageUrl: true } }),
    prisma.productAttribute.findMany({ where: { product: migratedProduct }, select: { attributeId: true } }),
    prisma.productTag.findMany({ where: { product: migratedProduct }, select: { tagId: true } }),
  ]);
  const urls = [...images.flatMap((i) => [i.url, i.thumbUrl ?? ""]), ...categoryImages.map((c) => c.imageUrl ?? "")];
  const attributeIds = [...new Set(attrLinks.map((a) => a.attributeId))];
  const tagIds = [...new Set(tagLinks.map((t) => t.tagId))];

  await prisma.$transaction(
    async (tx) => {
      await tx.product.deleteMany({ where: migratedProduct }); // variantes, imágenes, relaciones: en cascada
      await tx.category.deleteMany({ where: { wooId: { not: null } } });
      await tx.attribute.deleteMany({ where: { wooId: { not: null } } });
      // Atributos y etiquetas que creó la migración y quedaron sin ningún producto
      if (attributeIds.length > 0) await tx.attribute.deleteMany({ where: { id: { in: attributeIds }, wooId: null, products: { none: {} } } });
      if (tagIds.length > 0) await tx.tag.deleteMany({ where: { id: { in: tagIds }, products: { none: {} } } });
      if (opts.customers) await tx.user.deleteMany({ where: { wooId: { not: null }, role: "customer", points: 0, orders: { none: {} } } });
      await tx.migrationJob.deleteMany();
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  const files = await deleteFiles(urls);
  return { ...preview, customersDeletable: opts.customers ? preview.customersDeletable : 0, filesDeleted: files.deleted, filesFailed: files.failed };
}
