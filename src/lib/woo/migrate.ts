import { prisma as defaultPrisma } from "@/lib/prisma";
import { uniqueSlug, slugify } from "@/lib/slug";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { downloadImage } from "@/lib/remoteImage";
import { storeImage, type StoredImage } from "@/lib/storage";
import type { WooClient } from "./client";
import { customerName, decodeEntities, isEmail, mapPricing, mapShipping, mapStatus, mapStock, termSlug } from "./mapping";
import type { WooAttribute, WooCategory, WooCustomer, WooImage, WooProduct, WooProductAttribute, WooTerm, WooVariation } from "./types";

// Migración única desde WooCommerce. Es IDEMPOTENTE: cada registro se identifica
// por su wooId (upsert), así que se puede reintentar tras un corte sin duplicar.
// No migra pedidos, cupones ni reseñas. Los clientes llegan sin contraseña.

export type MigrationOptions = { customers: boolean };
type Entity = "categories" | "attributes" | "products" | "variants" | "images" | "customers";
export type Counters = Record<Entity, { created: number; updated: number; skipped: number; failed: number }>;
export type Issue = { level: "warning" | "error"; entity: string; ref: string; message: string };
export type Progress = { step: string; label: string; done: number; total: number };

const MAX_ISSUES = 200;

export class MigrationCancelled extends Error {}

export type Deps = {
  prisma?: typeof defaultPrisma;
  download?: (url: string) => Promise<Buffer>;
  store?: (data: Buffer) => Promise<StoredImage>;
};

const emptyCounters = (): Counters => ({
  categories: { created: 0, updated: 0, skipped: 0, failed: 0 },
  attributes: { created: 0, updated: 0, skipped: 0, failed: 0 },
  products: { created: 0, updated: 0, skipped: 0, failed: 0 },
  variants: { created: 0, updated: 0, skipped: 0, failed: 0 },
  images: { created: 0, updated: 0, skipped: 0, failed: 0 },
  customers: { created: 0, updated: 0, skipped: 0, failed: 0 },
});

class Reporter {
  counters = emptyCounters();
  issues: Issue[] = [];
  progress: Progress = { step: "", label: "", done: 0, total: 0 };
  private lastFlush = 0;
  constructor(private jobId: string, private db: typeof defaultPrisma) {}

  bump(entity: Entity, kind: "created" | "updated" | "skipped" | "failed") {
    this.counters[entity][kind]++;
  }
  issue(level: Issue["level"], entity: string, ref: string, message: string) {
    if (this.issues.length < MAX_ISSUES) this.issues.push({ level, entity, ref, message });
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
    const job = await this.db.migrationJob.update({
      where: { id: this.jobId },
      data: { progress: this.progress, counters: this.counters, issues: this.issues },
      select: { cancelRequested: true },
    });
    if (job.cancelRequested) throw new MigrationCancelled();
  }
}

type Ctx = {
  db: typeof defaultPrisma;
  client: WooClient;
  rep: Reporter;
  download: (url: string) => Promise<Buffer>;
  store: (data: Buffer) => Promise<StoredImage>;
  categoryIds: Map<number, string>; // wooId -> id local
  imageCache: Map<string, StoredImage>;
  termCache: Map<string, Map<string, string>>; // attributeId -> (termSlug -> termId)
};

async function fetchImage(ctx: Ctx, image: WooImage, ref: string): Promise<StoredImage | null> {
  const cached = ctx.imageCache.get(image.src);
  if (cached) return cached;
  try {
    const stored = await ctx.store(await ctx.download(image.src));
    ctx.imageCache.set(image.src, stored);
    ctx.rep.bump("images", "created");
    return stored;
  } catch (err) {
    ctx.rep.bump("images", "failed");
    ctx.rep.issue("warning", "imagen", ref, `No se pudo traer la imagen: ${err instanceof Error ? err.message : "error"}`);
    return null;
  }
}

// ---------- Categorías ----------

async function migrateCategories(ctx: Ctx) {
  const all: WooCategory[] = [];
  for await (const page of ctx.client.paged<WooCategory>("products/categories", { orderby: "id", order: "asc" })) all.push(...page);
  await ctx.rep.step("categories", "Categorías", all.length);

  // Padres antes que hijas
  const byId = new Map(all.map((c) => [c.id, c]));
  const ordered: WooCategory[] = [];
  const seen = new Set<number>();
  const visit = (c: WooCategory) => {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    const parent = byId.get(c.parent);
    if (parent) visit(parent);
    ordered.push(c);
  };
  all.forEach(visit);

  for (const c of ordered) {
    try {
      const existing = await ctx.db.category.findUnique({ where: { wooId: c.id } });
      const parentId = c.parent ? (ctx.categoryIds.get(c.parent) ?? null) : null;
      const name = decodeEntities(c.name);
      let imageUrl = existing?.imageUrl ?? null;
      if (!imageUrl && c.image?.src) imageUrl = (await fetchImage(ctx, c.image, `categoría ${name}`))?.url ?? null;
      const data = {
        name,
        description: c.description ? sanitizeRichHtml(c.description) : null,
        parentId,
        sortOrder: c.menu_order ?? 0,
        imageUrl,
      };
      if (existing) {
        await ctx.db.category.update({ where: { id: existing.id }, data });
        ctx.categoryIds.set(c.id, existing.id);
        ctx.rep.bump("categories", "updated");
      } else {
        const slug = await uniqueSlug(c.slug || name, async (s) => Boolean(await ctx.db.category.findUnique({ where: { slug: s }, select: { id: true } })));
        const created = await ctx.db.category.create({ data: { ...data, slug, wooId: c.id } });
        ctx.categoryIds.set(c.id, created.id);
        ctx.rep.bump("categories", "created");
      }
    } catch (err) {
      ctx.rep.bump("categories", "failed");
      ctx.rep.issue("error", "categoría", String(c.name), err instanceof Error ? err.message : "error");
    }
    await ctx.rep.tick();
  }
}

// ---------- Atributos ----------

async function termsOf(ctx: Ctx, attributeId: string): Promise<Map<string, string>> {
  let terms = ctx.termCache.get(attributeId);
  if (!terms) {
    const rows = await ctx.db.attributeTerm.findMany({ where: { attributeId }, select: { id: true, slug: true } });
    terms = new Map(rows.map((t) => [t.slug, t.id]));
    ctx.termCache.set(attributeId, terms);
  }
  return terms;
}

async function ensureTerm(ctx: Ctx, attributeId: string, name: string, sortOrder = 0): Promise<string> {
  const terms = await termsOf(ctx, attributeId);
  const slug = termSlug(name);
  const found = terms.get(slug);
  if (found) return found;
  const created = await ctx.db.attributeTerm.create({ data: { attributeId, name: decodeEntities(name), slug, sortOrder } });
  terms.set(slug, created.id);
  return created.id;
}

async function upsertAttribute(ctx: Ctx, input: { wooId: number | null; name: string; slug?: string }) {
  const name = decodeEntities(input.name);
  const existing = input.wooId
    ? await ctx.db.attribute.findUnique({ where: { wooId: input.wooId } })
    : await ctx.db.attribute.findFirst({ where: { slug: slugify(name), wooId: null } });
  if (existing) return { attribute: existing, created: false };
  const slug = await uniqueSlug(input.slug || name, async (s) => Boolean(await ctx.db.attribute.findUnique({ where: { slug: s }, select: { id: true } })));
  return { attribute: await ctx.db.attribute.create({ data: { name, slug, wooId: input.wooId } }), created: true };
}

async function migrateAttributes(ctx: Ctx) {
  const attrs: WooAttribute[] = [];
  for await (const page of ctx.client.paged<WooAttribute>("products/attributes")) attrs.push(...page);
  await ctx.rep.step("attributes", "Atributos", attrs.length);

  for (const a of attrs) {
    try {
      const { attribute, created } = await upsertAttribute(ctx, { wooId: a.id, name: a.name, slug: a.slug.replace(/^pa_/, "") });
      let index = 0;
      for await (const page of ctx.client.paged<WooTerm>(`products/attributes/${a.id}/terms`, { per_page: 100 })) {
        for (const t of page) await ensureTerm(ctx, attribute.id, t.name, t.menu_order ?? index++);
      }
      ctx.rep.bump("attributes", created ? "created" : "updated");
    } catch (err) {
      ctx.rep.bump("attributes", "failed");
      ctx.rep.issue("error", "atributo", a.name, err instanceof Error ? err.message : "error");
    }
    await ctx.rep.tick();
  }
}

// ---------- Productos ----------

type ProductAttr = { attributeId: string; wooId: number; nameSlug: string };

async function resolveProductAttributes(ctx: Ctx, wp: WooProduct): Promise<ProductAttr[]> {
  const result: ProductAttr[] = [];
  for (const pa of (wp.attributes ?? []).filter((a: WooProductAttribute) => a.variation)) {
    const { attribute } = await upsertAttribute(ctx, { wooId: pa.id || null, name: pa.name });
    for (const option of pa.options) await ensureTerm(ctx, attribute.id, option);
    result.push({ attributeId: attribute.id, wooId: pa.id, nameSlug: slugify(decodeEntities(pa.name)) });
  }
  return result;
}

async function skuTaken(ctx: Ctx, sku: string, except: { productId?: string; variantId?: string }): Promise<boolean> {
  const [product, variant] = await Promise.all([
    ctx.db.product.findFirst({ where: { sku, ...(except.productId ? { NOT: { id: except.productId } } : {}) }, select: { id: true } }),
    ctx.db.variant.findFirst({ where: { sku, ...(except.variantId ? { NOT: { id: except.variantId } } : {}) }, select: { id: true } }),
  ]);
  return Boolean(product || variant);
}

// Sincroniza las imágenes de Woo (por URL de origen). Devuelve src -> id de ProductImage.
async function syncImages(ctx: Ctx, productId: string, images: WooImage[], ref: string): Promise<Map<string, string>> {
  const existing = await ctx.db.productImage.findMany({ where: { productId } });
  const bySource = new Map(existing.filter((i) => i.sourceUrl).map((i) => [i.sourceUrl!, i]));
  const result = new Map<string, string>();
  const wanted = new Set(images.map((i) => i.src));

  let order = 0;
  for (const image of images) {
    const row = bySource.get(image.src);
    if (row) {
      await ctx.db.productImage.update({ where: { id: row.id }, data: { sortOrder: order } });
      result.set(image.src, row.id);
      ctx.rep.bump("images", "skipped");
    } else {
      const stored = await fetchImage(ctx, image, ref);
      if (!stored) continue;
      const created = await ctx.db.productImage.create({
        data: { productId, url: stored.url, thumbUrl: stored.thumbUrl, alt: image.alt || null, sortOrder: order, sourceUrl: image.src },
      });
      result.set(image.src, created.id);
    }
    order++;
  }
  const stale = existing.filter((i) => i.sourceUrl && !wanted.has(i.sourceUrl)).map((i) => i.id);
  if (stale.length) await ctx.db.productImage.deleteMany({ where: { id: { in: stale } } });
  return result;
}

async function migrateVariations(ctx: Ctx, wp: WooProduct, productId: string, attrs: ProductAttr[], imageIds: Map<string, string>) {
  const keptWooIds: number[] = [];
  const seenCombos = new Set<string>();
  let extraImageOrder = imageIds.size;

  for await (const page of ctx.client.paged<WooVariation>(`products/${wp.id}/variations`, { per_page: 100 })) {
    for (const v of page) {
      const ref = `${decodeEntities(wp.name)} (variación ${v.id})`;
      try {
        const termIds: string[] = [];
        let complete = true;
        for (const va of v.attributes ?? []) {
          const attr = attrs.find((a) => (va.id ? a.wooId === va.id : a.nameSlug === slugify(decodeEntities(va.name))));
          if (!attr || !va.option) { complete = false; break; }
          termIds.push(await ensureTerm(ctx, attr.attributeId, va.option));
        }
        if (!complete || termIds.length !== attrs.length) {
          ctx.rep.bump("variants", "skipped");
          ctx.rep.issue("warning", "variante", ref, "Variación con atributos 'cualquiera' o incompletos: se omitió");
          continue;
        }
        const combo = [...termIds].sort().join("|");
        if (seenCombos.has(combo)) {
          ctx.rep.bump("variants", "skipped");
          ctx.rep.issue("warning", "variante", ref, "Combinación de atributos repetida: se omitió");
          continue;
        }
        seenCombos.add(combo);

        const existing = await ctx.db.variant.findUnique({ where: { wooId: v.id } });
        let sku = v.sku?.trim() || null;
        if (sku && (await skuTaken(ctx, sku, { variantId: existing?.id }))) {
          ctx.rep.issue("warning", "variante", ref, `SKU duplicado "${sku}": se importó sin SKU`);
          sku = null;
        }
        let imageId: string | null = null;
        if (v.image?.src) {
          imageId = imageIds.get(v.image.src) ?? null;
          if (!imageId) {
            const stored = await fetchImage(ctx, v.image, ref);
            if (stored) {
              const created = await ctx.db.productImage.create({
                data: { productId, url: stored.url, thumbUrl: stored.thumbUrl, sortOrder: extraImageOrder++, sourceUrl: v.image.src },
              });
              imageId = created.id;
              imageIds.set(v.image.src, created.id);
            }
          }
        }
        const pricing = mapPricing(v);
        const data = {
          sku,
          ...pricing,
          ...mapStock(v.manage_stock === "parent" ? { ...v, manage_stock: false } : v),
          enabled: (v.status ?? "publish") === "publish",
          ...mapShipping({ weight: v.weight, dimensions: v.dimensions }),
          imageId,
        };
        const variant = existing
          ? await ctx.db.variant.update({ where: { id: existing.id }, data })
          : await ctx.db.variant.create({ data: { ...data, productId, wooId: v.id } });
        await ctx.db.variantAttributeTerm.deleteMany({ where: { variantId: variant.id } });
        await ctx.db.variantAttributeTerm.createMany({ data: termIds.map((termId) => ({ variantId: variant.id, termId })) });
        keptWooIds.push(v.id);
        ctx.rep.bump("variants", existing ? "updated" : "created");
      } catch (err) {
        ctx.rep.bump("variants", "failed");
        ctx.rep.issue("error", "variante", ref, err instanceof Error ? err.message : "error");
      }
    }
  }
  // Variantes que ya no existen en Woo
  await ctx.db.variant.deleteMany({ where: { productId, wooId: { not: null, notIn: keptWooIds } } });
}

async function migrateProduct(ctx: Ctx, wp: WooProduct) {
  const name = decodeEntities(wp.name);
  if (wp.type !== "simple" && wp.type !== "variable") {
    ctx.rep.bump("products", "skipped");
    ctx.rep.issue("warning", "producto", name, `Tipo "${wp.type}" no soportado (solo simple y variable): se omitió`);
    return;
  }

  const existing = await ctx.db.product.findUnique({ where: { wooId: wp.id } });
  let sku = wp.sku?.trim() || null;
  if (sku && (await skuTaken(ctx, sku, { productId: existing?.id }))) {
    ctx.rep.issue("warning", "producto", name, `SKU duplicado "${sku}": se importó sin SKU`);
    sku = null;
  }
  const variable = wp.type === "variable";
  const base = {
    name,
    sku,
    type: variable ? ("variable" as const) : ("simple" as const),
    status: mapStatus(wp.status),
    shortDescription: wp.short_description ? sanitizeRichHtml(wp.short_description) : null,
    description: wp.description ? sanitizeRichHtml(wp.description) : null,
    featured: Boolean(wp.featured),
    ...mapShipping(wp),
    ...(variable
      ? { price: 0, compareAtPrice: null, stock: 0, manageStock: true }
      : { ...mapPricing(wp), ...mapStock(wp) }),
  };

  const categoryIds = (wp.categories ?? []).map((c) => ctx.categoryIds.get(c.id)).filter((id): id is string => Boolean(id));
  const attrs = variable ? await resolveProductAttributes(ctx, wp) : [];

  const product = await ctx.db.$transaction(async (tx) => {
    let row;
    if (existing) {
      row = await tx.product.update({ where: { id: existing.id }, data: base }); // el slug no cambia
    } else {
      const slug = await uniqueSlug(wp.slug || name, async (s) => Boolean(await tx.product.findUnique({ where: { slug: s }, select: { id: true } })));
      row = await tx.product.create({ data: { ...base, slug, wooId: wp.id } });
    }
    await tx.productCategory.deleteMany({ where: { productId: row.id } });
    if (categoryIds.length) await tx.productCategory.createMany({ data: [...new Set(categoryIds)].map((categoryId) => ({ productId: row.id, categoryId })) });
    await tx.productAttribute.deleteMany({ where: { productId: row.id } });
    if (attrs.length) await tx.productAttribute.createMany({ data: attrs.map((a, i) => ({ productId: row.id, attributeId: a.attributeId, sortOrder: i })) });
    return row;
  });

  const images = [...(wp.images ?? [])];
  const imageIds = await syncImages(ctx, product.id, images, name);
  if (variable) await migrateVariations(ctx, wp, product.id, attrs, imageIds);
  else await ctx.db.variant.deleteMany({ where: { productId: product.id, wooId: { not: null } } });
  ctx.rep.bump("products", existing ? "updated" : "created");
}

async function migrateProducts(ctx: Ctx) {
  const first = await ctx.client.get<WooProduct[]>("products", { per_page: 1, status: "any" });
  await ctx.rep.step("products", "Productos, variantes e imágenes", first.total);
  for await (const page of ctx.client.paged<WooProduct>("products", { status: "any", orderby: "id", order: "asc" })) {
    for (const wp of page) {
      try {
        await migrateProduct(ctx, wp);
      } catch (err) {
        if (err instanceof MigrationCancelled) throw err;
        ctx.rep.bump("products", "failed");
        ctx.rep.issue("error", "producto", decodeEntities(wp.name ?? String(wp.id)), err instanceof Error ? err.message : "error");
      }
      await ctx.rep.tick();
    }
  }
}

// ---------- Clientes ----------

async function migrateCustomers(ctx: Ctx) {
  const first = await ctx.client.get<WooCustomer[]>("customers", { per_page: 1, role: "all" });
  await ctx.rep.step("customers", "Clientes", first.total);
  for await (const page of ctx.client.paged<WooCustomer>("customers", { role: "all", orderby: "id", order: "asc" })) {
    for (const c of page) {
      try {
        if (!isEmail(c.email)) {
          ctx.rep.bump("customers", "skipped");
          ctx.rep.issue("warning", "cliente", `#${c.id}`, "Sin email válido: se omitió");
        } else {
          const email = c.email.trim().toLowerCase();
          const byWoo = await ctx.db.user.findUnique({ where: { wooId: c.id } });
          const byEmail = byWoo ?? (await ctx.db.user.findUnique({ where: { email } }));
          if (byEmail) {
            // No se pisan datos ni contraseña de cuentas existentes: solo se vincula el wooId.
            if (!byEmail.wooId) await ctx.db.user.update({ where: { id: byEmail.id }, data: { wooId: c.id } }).catch(() => undefined);
            ctx.rep.bump("customers", "updated");
          } else {
            await ctx.db.user.create({ data: { email, name: customerName(c), phone: c.billing?.phone?.trim() || null, wooId: c.id } });
            ctx.rep.bump("customers", "created");
          }
        }
      } catch (err) {
        ctx.rep.bump("customers", "failed");
        ctx.rep.issue("error", "cliente", String(c.email ?? c.id), err instanceof Error ? err.message : "error");
      }
      await ctx.rep.tick();
    }
  }
}

// ---------- Orquestación ----------

export async function runMigration(jobId: string, client: WooClient, options: MigrationOptions, deps: Deps = {}) {
  const db = deps.prisma ?? defaultPrisma;
  const rep = new Reporter(jobId, db);
  const ctx: Ctx = {
    db,
    client,
    rep,
    download: deps.download ?? downloadImage,
    store: deps.store ?? storeImage,
    categoryIds: new Map(),
    imageCache: new Map(),
    termCache: new Map(),
  };
  // Categorías ya migradas en corridas anteriores (por si esta corrida se reanuda)
  for (const c of await db.category.findMany({ where: { wooId: { not: null } }, select: { id: true, wooId: true } })) ctx.categoryIds.set(c.wooId!, c.id);

  try {
    await migrateCategories(ctx);
    await migrateAttributes(ctx);
    await migrateProducts(ctx);
    if (options.customers) await migrateCustomers(ctx);
    await rep.step("done", "Terminado", 0);
    await db.migrationJob.update({
      where: { id: jobId },
      data: { status: "done", finishedAt: new Date(), counters: rep.counters, issues: rep.issues, progress: rep.progress },
    });
  } catch (err) {
    const cancelled = err instanceof MigrationCancelled;
    if (!cancelled) rep.issue("error", "migración", "general", err instanceof Error ? err.message : "Error inesperado");
    await db.migrationJob.update({
      where: { id: jobId },
      data: { status: cancelled ? "cancelled" : "failed", finishedAt: new Date(), counters: rep.counters, issues: rep.issues, progress: rep.progress },
    });
  }
}
