import { prisma as defaultPrisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { downloadImage } from "@/lib/remoteImage";
import { storeImage, type StoredImage } from "@/lib/storage";
import { imageKey, textToHtml, type Existing, type ImageRef, type Issue, type PlannedProduct } from "./parse";

// Aplica un plan ya validado (ver parse.ts). Corre en segundo plano y va dejando el progreso en ImportJob.
// Reimportar es seguro: productos y variantes se buscan por SKU y las imágenes por su origen (URL o nombre en el ZIP),
// así que no se duplican ni se vuelven a subir.

type Db = typeof defaultPrisma;
type Entity = "products" | "variants" | "images";
export type Counters = Record<Entity, { created: number; updated: number; skipped: number; failed: number }>;
export type Progress = { step: string; label: string; done: number; total: number };

const MAX_ISSUES = 300;

export class ImportCancelled extends Error {}

export type ZipFiles = Map<string, () => Promise<Buffer>>; // nombre de archivo (minúsculas) → lector

export async function readZip(buffer: Buffer | ArrayBuffer): Promise<ZipFiles> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const files: ZipFiles = new Map();
  zip.forEach((path, entry) => {
    if (entry.dir || path.startsWith("__MACOSX/") || /(^|\/)\./.test(path)) return;
    const name = path.split("/").pop()!.toLowerCase();
    if (!files.has(name)) files.set(name, async () => Buffer.from(await entry.async("uint8array")));
  });
  return files;
}

export async function loadExisting(db: Db = defaultPrisma): Promise<Existing> {
  const [products, variants] = await Promise.all([
    db.product.findMany({ where: { sku: { not: null } }, select: { id: true, sku: true, type: true, attributes: { select: { attribute: { select: { slug: true } } } } } }),
    db.variant.findMany({ where: { sku: { not: null } }, select: { id: true, sku: true, product: { select: { sku: true } } } }),
  ]);
  return {
    products: new Map(products.map((p) => [p.sku!.toLowerCase(), { id: p.id, type: p.type, attributeSlugs: p.attributes.map((a) => a.attribute.slug) }])),
    variants: new Map(variants.map((v) => [v.sku!.toLowerCase(), { id: v.id, productSku: v.product.sku }])),
  };
}

const emptyCounters = (): Counters => ({
  products: { created: 0, updated: 0, skipped: 0, failed: 0 },
  variants: { created: 0, updated: 0, skipped: 0, failed: 0 },
  images: { created: 0, updated: 0, skipped: 0, failed: 0 },
});

class Reporter {
  counters = emptyCounters();
  issues: Issue[];
  progress: Progress = { step: "", label: "", done: 0, total: 0 };
  private lastFlush = 0;
  constructor(private jobId: string, private db: Db, initial: Issue[]) {
    this.issues = initial.slice(0, MAX_ISSUES);
  }
  bump(entity: Entity, kind: keyof Counters[Entity]) {
    this.counters[entity][kind]++;
  }
  issue(level: Issue["level"], row: number | null, sku: string, message: string) {
    if (this.issues.length < MAX_ISSUES) this.issues.push({ level, row, sku, message });
  }
  async step(step: string, label: string, total: number) {
    this.progress = { step, label, done: 0, total };
    await this.flush(true);
  }
  async tick() {
    this.progress.done++;
    await this.flush(false);
  }
  async flush(force: boolean) {
    const now = Date.now();
    if (!force && now - this.lastFlush < 700) return;
    this.lastFlush = now;
    const job = await this.db.importJob.update({
      where: { id: this.jobId },
      data: { progress: this.progress, counters: this.counters, issues: this.issues },
      select: { cancelRequested: true },
    });
    if (job.cancelRequested) throw new ImportCancelled();
  }
}

export type Deps = {
  prisma?: Db;
  download?: (url: string) => Promise<Buffer>;
  store?: (data: Buffer) => Promise<StoredImage>;
};

type Ctx = {
  db: Db;
  rep: Reporter;
  zip: ZipFiles | null;
  download: (url: string) => Promise<Buffer>;
  store: (data: Buffer) => Promise<StoredImage>;
  imageCache: Map<string, StoredImage | null>; // origen → imagen guardada (null = falló)
  categoryCache: Map<string, string>; // "padreId|slug" → id
  attributeCache: Map<string, { id: string; terms: Map<string, string> }>; // slug → id y términos (slug → id)
};

// ---------- Categorías, etiquetas y atributos ----------

async function ensureCategoryPath(ctx: Ctx, path: string[]): Promise<string> {
  let parentId: string | null = null;
  for (const name of path) {
    const key = `${parentId ?? ""}|${slugify(name)}`;
    let id = ctx.categoryCache.get(key);
    if (!id) {
      const siblings: { id: string; name: string }[] = await ctx.db.category.findMany({ where: { parentId }, select: { id: true, name: true } });
      id = siblings.find((c) => slugify(c.name) === slugify(name))?.id;
      if (!id) {
        const slug = await uniqueSlug(name, async (s) => Boolean(await ctx.db.category.findUnique({ where: { slug: s }, select: { id: true } })));
        id = (await ctx.db.category.create({ data: { name: name.slice(0, 120), slug, parentId } })).id;
      }
      ctx.categoryCache.set(key, id);
    }
    parentId = id;
  }
  return parentId!;
}

async function ensureAttribute(ctx: Ctx, name: string) {
  const slug = slugify(name);
  let attr = ctx.attributeCache.get(slug);
  if (!attr) {
    const row = (await ctx.db.attribute.findUnique({ where: { slug }, include: { terms: { select: { id: true, slug: true } } } })) ?? (await ctx.db.attribute.create({ data: { name, slug }, include: { terms: { select: { id: true, slug: true } } } }));
    attr = { id: row.id, terms: new Map(row.terms.map((t) => [t.slug, t.id])) };
    ctx.attributeCache.set(slug, attr);
  }
  return attr;
}

async function ensureTerm(ctx: Ctx, attributeName: string, value: string): Promise<string> {
  const attr = await ensureAttribute(ctx, attributeName);
  const slug = slugify(value);
  let id = attr.terms.get(slug);
  if (!id) {
    id = (await ctx.db.attributeTerm.create({ data: { attributeId: attr.id, name: value.slice(0, 80), slug, sortOrder: attr.terms.size } })).id;
    attr.terms.set(slug, id);
  }
  return id;
}

// ---------- Imágenes ----------

async function fetchImage(ctx: Ctx, ref: ImageRef, row: number, sku: string): Promise<StoredImage | null> {
  const key = imageKey(ref);
  if (ctx.imageCache.has(key)) return ctx.imageCache.get(key)!;
  let stored: StoredImage | null = null;
  try {
    let data: Buffer;
    if (ref.kind === "url") data = await ctx.download(ref.url);
    else {
      const read = ctx.zip?.get(ref.name.toLowerCase());
      if (!read) throw new Error("no está en el ZIP");
      data = await read();
    }
    stored = await ctx.store(data);
    ctx.rep.bump("images", "created");
  } catch (err) {
    ctx.rep.bump("images", "failed");
    const what = ref.kind === "url" ? ref.url : ref.name;
    ctx.rep.issue("warning", row, sku, `No se pudo usar la imagen ${what}: ${err instanceof Error ? err.message : "error"}`);
  }
  ctx.imageCache.set(key, stored);
  return stored;
}

// Deja la galería del producto con exactamente estas imágenes y en este orden. Reusa las ya importadas (por origen).
// Devuelve origen → id de ProductImage.
async function syncGallery(ctx: Ctx, productId: string, refs: { ref: ImageRef; row: number; sku: string }[]): Promise<Map<string, string>> {
  const existing = await ctx.db.productImage.findMany({ where: { productId } });
  const bySource = new Map(existing.filter((i) => i.sourceUrl).map((i) => [i.sourceUrl!, i]));
  const result = new Map<string, string>();
  let order = 0;
  for (const { ref, row, sku } of refs) {
    const key = imageKey(ref);
    if (result.has(key)) continue;
    const found = bySource.get(key);
    if (found) {
      await ctx.db.productImage.update({ where: { id: found.id }, data: { sortOrder: order++ } });
      result.set(key, found.id);
      ctx.rep.bump("images", "skipped");
      continue;
    }
    const stored = await fetchImage(ctx, ref, row, sku);
    if (!stored) continue;
    const created = await ctx.db.productImage.create({ data: { productId, url: stored.url, thumbUrl: stored.thumbUrl, sortOrder: order++, sourceUrl: key } });
    result.set(key, created.id);
  }
  // Si alguna imagen pedida falló, no se borra la galería vieja (mejor quedarse con algo que sin nada)
  const allOk = refs.every(({ ref }) => result.has(imageKey(ref)));
  if (allOk) {
    const keep = new Set(result.values());
    const stale = existing.filter((i) => !keep.has(i.id)).map((i) => i.id);
    if (stale.length) await ctx.db.productImage.deleteMany({ where: { id: { in: stale } } });
  }
  return result;
}

// ---------- Productos ----------

const html = (text: string | undefined) => (text === undefined ? undefined : sanitizeRichHtml(textToHtml(text)));
const def = <T extends object>(obj: T) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;

function stockData(stock: number | undefined, isNew: boolean) {
  if (stock !== undefined) return { stock, manageStock: true };
  return isNew ? { stock: 0, manageStock: true } : {};
}

async function setCategoriesAndTags(ctx: Ctx, productId: string, p: PlannedProduct) {
  if (p.categories) {
    const ids = [...new Set(await Promise.all(p.categories.map((path) => ensureCategoryPath(ctx, path))))];
    await ctx.db.productCategory.deleteMany({ where: { productId } });
    await ctx.db.productCategory.createMany({ data: ids.map((categoryId) => ({ productId, categoryId })) });
  }
  if (p.tags) {
    await ctx.db.productTag.deleteMany({ where: { productId } });
    const bySlug = new Map(p.tags.map((t) => [slugify(t), t]));
    for (const [slug, name] of [...bySlug].slice(0, 30)) {
      const tag = await ctx.db.tag.upsert({ where: { slug }, create: { name: name.slice(0, 60), slug }, update: {} });
      await ctx.db.productTag.create({ data: { productId, tagId: tag.id } });
    }
  }
}

async function upsertProductRow(ctx: Ctx, p: PlannedProduct, extra: Record<string, unknown>) {
  const existing = await ctx.db.product.findFirst({ where: { sku: { equals: p.sku, mode: "insensitive" } }, select: { id: true } });
  const data = {
    ...def({
      name: p.name?.slice(0, 200),
      status: p.status,
      featured: p.featured,
      shortDescription: html(p.shortDescription),
      description: html(p.description),
    }),
    ...extra,
  };
  if (existing) return { id: (await ctx.db.product.update({ where: { id: existing.id }, data })).id, created: false };
  const slug = await uniqueSlug(p.name!, async (s) => Boolean(await ctx.db.product.findUnique({ where: { slug: s }, select: { id: true } })));
  const created = await ctx.db.product.create({ data: { name: p.name!, status: "published", ...data, sku: p.sku, slug } });
  return { id: created.id, created: true };
}

async function importSimple(ctx: Ctx, p: Extract<PlannedProduct, { kind: "simple" }>) {
  const isNewGuess = !(await ctx.db.product.findFirst({ where: { sku: { equals: p.sku, mode: "insensitive" } }, select: { id: true } }));
  const { id, created } = await upsertProductRow(ctx, p, {
    type: "simple",
    ...def({ price: p.price, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice, weight: p.weight, width: p.width, height: p.height, length: p.length }),
    ...stockData(p.stock, isNewGuess),
  });
  await setCategoriesAndTags(ctx, id, p);
  if (p.images) await syncGallery(ctx, id, p.images.map((ref) => ({ ref, row: p.row, sku: p.sku })));
  ctx.rep.bump("products", created ? "created" : "updated");
}

async function importVariable(ctx: Ctx, p: Extract<PlannedProduct, { kind: "variable" }>) {
  // Peso y medidas del producto: los de la primera variante que los traiga (sirven de base para el envío)
  const firstWith = (k: "weight" | "width" | "height" | "length") => p.variants.find((v) => v[k] !== undefined)?.[k];
  const { id, created } = await upsertProductRow(ctx, p, {
    type: "variable",
    price: 0,
    compareAtPrice: null,
    ...def({ weight: firstWith("weight"), width: firstWith("width"), height: firstWith("height"), length: firstWith("length") }),
  });
  await setCategoriesAndTags(ctx, id, p);

  // Atributos del producto (en el orden de las columnas)
  const attrIds = [];
  for (const name of p.attributes) attrIds.push((await ensureAttribute(ctx, name)).id);
  await ctx.db.productAttribute.deleteMany({ where: { productId: id, attributeId: { notIn: attrIds } } });
  for (const [sortOrder, attributeId] of attrIds.entries()) {
    await ctx.db.productAttribute.upsert({ where: { productId_attributeId: { productId: id, attributeId } }, create: { productId: id, attributeId, sortOrder }, update: { sortOrder } });
  }

  // Galería = todas las imágenes de las filas del grupo, en orden de aparición. Cada variante usa la primera de su fila.
  const refs = p.variants.flatMap((v) => (v.images ?? []).map((ref) => ({ ref, row: v.row, sku: v.sku })));
  const imageIds = refs.length ? await syncGallery(ctx, id, refs) : new Map<string, string>();

  for (const v of p.variants) {
    try {
      const termIds = [];
      for (const t of v.terms) termIds.push(await ensureTerm(ctx, t.attribute, t.value));
      const existing = await ctx.db.variant.findFirst({ where: { sku: { equals: v.sku, mode: "insensitive" } }, select: { id: true } });
      const firstImage = v.images?.[0];
      const data = {
        ...def({ price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, weight: v.weight, width: v.width, height: v.height, length: v.length }),
        ...stockData(v.stock, !existing),
        ...(firstImage ? { imageId: imageIds.get(imageKey(firstImage)) ?? null } : {}),
      };
      const variant = existing
        ? await ctx.db.variant.update({ where: { id: existing.id }, data })
        : await ctx.db.variant.create({ data: { ...data, sku: v.sku, productId: id } });
      await ctx.db.variantAttributeTerm.deleteMany({ where: { variantId: variant.id } });
      await ctx.db.variantAttributeTerm.createMany({ data: termIds.map((termId) => ({ variantId: variant.id, termId })) });
      ctx.rep.bump("variants", existing ? "updated" : "created");
    } catch (err) {
      ctx.rep.bump("variants", "failed");
      ctx.rep.issue("error", v.row, v.sku, err instanceof Error ? err.message : "error");
    }
  }
  ctx.rep.bump("products", created ? "created" : "updated");
}

// Fila suelta con el SKU de una variante existente: actualiza solo esa variante. Si trae imagen, se suma a la galería
// del producto (si no estaba) y pasa a ser la foto de la variante.
async function importVariantUpdate(ctx: Ctx, p: Extract<PlannedProduct, { kind: "variantUpdate" }>) {
  const variant = await ctx.db.variant.findFirst({ where: { sku: { equals: p.sku, mode: "insensitive" } }, select: { id: true, productId: true } });
  if (!variant) throw new Error("La variante ya no existe");
  let imageId: string | null | undefined;
  const ref = p.images?.[0];
  if (ref) {
    const key = imageKey(ref);
    const found = await ctx.db.productImage.findFirst({ where: { productId: variant.productId, sourceUrl: key }, select: { id: true } });
    if (found) imageId = found.id;
    else {
      const stored = await fetchImage(ctx, ref, p.row, p.sku);
      if (stored) {
        const last = await ctx.db.productImage.aggregate({ where: { productId: variant.productId }, _max: { sortOrder: true } });
        imageId = (await ctx.db.productImage.create({ data: { productId: variant.productId, url: stored.url, thumbUrl: stored.thumbUrl, sortOrder: (last._max.sortOrder ?? -1) + 1, sourceUrl: key } })).id;
      }
    }
  }
  await ctx.db.variant.update({
    where: { id: variant.id },
    data: {
      ...def({ price: p.price, compareAtPrice: p.compareAtPrice, costPrice: p.costPrice, weight: p.weight, width: p.width, height: p.height, length: p.length, imageId }),
      ...stockData(p.stock, false),
    },
  });
  ctx.rep.bump("variants", "updated");
}

// ---------- Orquestación ----------

export async function runImport(jobId: string, products: PlannedProduct[], previousIssues: Issue[], zip: ZipFiles | null, deps: Deps = {}) {
  const db = deps.prisma ?? defaultPrisma;
  const rep = new Reporter(jobId, db, previousIssues);
  const ctx: Ctx = {
    db,
    rep,
    zip,
    download: deps.download ?? downloadImage,
    store: deps.store ?? storeImage,
    imageCache: new Map(),
    categoryCache: new Map(),
    attributeCache: new Map(),
  };
  try {
    await rep.step("products", "Productos, variantes e imágenes", products.length);
    for (const p of products) {
      try {
        if (p.kind === "simple") await importSimple(ctx, p);
        else if (p.kind === "variable") await importVariable(ctx, p);
        else await importVariantUpdate(ctx, p);
      } catch (err) {
        if (err instanceof ImportCancelled) throw err;
        rep.bump("products", "failed");
        rep.issue("error", p.row, p.sku, err instanceof Error ? err.message : "error");
      }
      await rep.tick();
    }
    await rep.step("done", "Terminado", 0);
    await db.importJob.update({ where: { id: jobId }, data: { status: "done", finishedAt: new Date(), counters: rep.counters, issues: rep.issues, progress: rep.progress } });
  } catch (err) {
    const cancelled = err instanceof ImportCancelled;
    if (!cancelled) rep.issue("error", null, "", err instanceof Error ? err.message : "Error inesperado");
    await db.importJob.update({
      where: { id: jobId },
      data: { status: cancelled ? "cancelled" : "failed", finishedAt: new Date(), counters: rep.counters, issues: rep.issues, progress: rep.progress },
    });
  }
}
