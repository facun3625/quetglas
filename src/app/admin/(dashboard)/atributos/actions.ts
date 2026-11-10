"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

const HEX = /^#[0-9a-f]{6}$/i;

function refresh(id?: string) {
  revalidatePath("/admin/atributos");
  if (id) revalidatePath(`/admin/atributos/${id}`);
  revalidatePath("/admin/productos", "layout");
}

// "Rojo|#ff0000" → { name: "Rojo", colorHex: "#ff0000" }
function parseLine(line: string): { name: string; slug: string; colorHex: string | null } | null {
  const [label, color] = line.split("|").map((p) => p.trim());
  const name = (label ?? "").slice(0, 80);
  const slug = slugify(name);
  if (!name || !slug) return null;
  return { name, slug, colorHex: HEX.test(color ?? "") ? color : null };
}

// Una línea por valor; si se repite (sin importar mayúsculas), queda la primera
function parseTerms(text: string) {
  const seen = new Set<string>();
  const out: NonNullable<ReturnType<typeof parseLine>>[] = [];
  for (const line of text.split("\n")) {
    const t = parseLine(line.trim());
    if (t && !seen.has(t.slug)) {
      seen.add(t.slug);
      out.push(t);
    }
  }
  return out;
}

export async function createAttribute(input: { name: string; terms: string }): Promise<Result> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Poné un nombre para el atributo." };
  const slug = await uniqueSlug(name, async (candidate) => Boolean(await prisma.attribute.findFirst({ where: { slug: candidate }, select: { id: true } })));
  const parsed = parseTerms(input.terms);
  const attribute = await prisma.attribute.create({
    data: { name, slug, terms: { create: parsed.map((t, i) => ({ ...t, sortOrder: i })) } },
  });
  await logAdminAction("attribute.create", { targetType: "attribute", targetId: attribute.id, detail: name });
  refresh();
  return { ok: true, id: attribute.id };
}

export async function renameAttribute(id: string, nameInput: string): Promise<Result> {
  await requireAdmin();
  const name = nameInput.trim().slice(0, 80);
  if (!name) return { ok: false, error: "El nombre no puede quedar vacío." };
  const slug = await uniqueSlug(name, async (candidate) => Boolean(await prisma.attribute.findFirst({ where: { slug: candidate, NOT: { id } }, select: { id: true } })));
  await prisma.attribute.update({ where: { id }, data: { name, slug } });
  refresh(id);
  return { ok: true, message: "Nombre guardado." };
}

// Agrega valores nuevos (uno por línea, con color opcional "Rojo|#ff0000"). Los repetidos se omiten.
export async function addTerms(attributeId: string, text: string): Promise<Result> {
  await requireAdmin();
  const wanted = parseTerms(text);
  if (wanted.length === 0) return { ok: false, error: "Escribí al menos un valor." };
  const existing = await prisma.attributeTerm.findMany({ where: { attributeId }, select: { slug: true, sortOrder: true } });
  const taken = new Set(existing.map((t) => t.slug));
  const fresh = wanted.filter((t) => !taken.has(t.slug));
  if (fresh.length === 0) return { ok: false, error: "Esos valores ya existen." };
  let order = existing.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1;
  await prisma.attributeTerm.createMany({ data: fresh.map((t) => ({ ...t, attributeId, sortOrder: order++ })) });
  refresh(attributeId);
  const skipped = wanted.length - fresh.length;
  return { ok: true, message: `Se agregaron ${fresh.length} valor${fresh.length === 1 ? "" : "es"}${skipped ? ` (${skipped} ya existían)` : ""}.` };
}

export async function updateTerm(id: string, input: { name: string; colorHex: string }): Promise<Result> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 80);
  const slug = slugify(name);
  if (!name || !slug) return { ok: false, error: "El valor no puede quedar vacío." };
  const term = await prisma.attributeTerm.findUnique({ where: { id }, select: { attributeId: true } });
  if (!term) return { ok: false, error: "Ese valor ya no existe." };
  const clash = await prisma.attributeTerm.findFirst({ where: { attributeId: term.attributeId, slug, NOT: { id } }, select: { id: true } });
  if (clash) return { ok: false, error: "Ya existe otro valor con ese nombre." };
  await prisma.attributeTerm.update({ where: { id }, data: { name, slug, colorHex: HEX.test(input.colorHex) ? input.colorHex : null } });
  refresh(term.attributeId);
  return { ok: true };
}

// Borrar un valor elimina las variantes que lo usan (se avisa antes en la pantalla)
export async function deleteTerm(id: string): Promise<Result> {
  await requireAdmin();
  const term = await prisma.attributeTerm.findUnique({ where: { id }, select: { attributeId: true, name: true } });
  if (!term) return { ok: true };
  await prisma.$transaction(async (tx) => {
    const variantIds = (await tx.variantAttributeTerm.findMany({ where: { termId: id }, select: { variantId: true } })).map((v) => v.variantId);
    if (variantIds.length > 0) await tx.variant.deleteMany({ where: { id: { in: variantIds } } });
    await tx.attributeTerm.delete({ where: { id } });
  });
  refresh(term.attributeId);
  return { ok: true };
}

export async function deleteAttributeAction(id: string): Promise<Result> {
  await requireAdmin();
  const attr = await prisma.attribute.findUnique({ where: { id }, select: { name: true } });
  if (!attr) return { ok: true };
  await prisma.attribute.delete({ where: { id } });
  await logAdminAction("attribute.delete", { targetType: "attribute", targetId: id, detail: attr.name });
  refresh();
  return { ok: true };
}
