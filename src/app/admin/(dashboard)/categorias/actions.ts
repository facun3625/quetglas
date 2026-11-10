"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

export type CategoryInput = {
  name: string;
  slug: string;
  parentId: string;
  sortOrder: number;
  description: string;
  comingSoonMessage: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
};

const nul = (v: string, max = 500) => v.trim().slice(0, max) || null;

function refresh(id?: string) {
  revalidatePath("/admin/categorias");
  if (id) revalidatePath(`/admin/categorias/${id}`);
  revalidatePath("/tienda");
  revalidatePath("/");
}

// ¿`candidate` es la categoría `id` o una de sus descendientes? (para no crear ciclos al elegir el padre)
async function isSelfOrDescendant(id: string, candidate: string): Promise<boolean> {
  let cursor: string | null = candidate;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === id) return true;
    seen.add(cursor);
    cursor = (await prisma.category.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
  }
  return false;
}

export async function createCategory(input: { name: string; parentId: string }): Promise<Result> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 100);
  if (!name) return { ok: false, error: "Poné un nombre para la categoría." };
  const parentId = input.parentId || null;
  if (parentId && !(await prisma.category.findUnique({ where: { id: parentId }, select: { id: true } }))) return { ok: false, error: "La categoría padre ya no existe." };
  const slug = await uniqueSlug(name, async (c) => Boolean(await prisma.category.findFirst({ where: { slug: c }, select: { id: true } })));
  const created = await prisma.category.create({ data: { name, slug, parentId } });
  await logAdminAction("category.create", { targetType: "category", targetId: created.id, detail: name });
  refresh();
  return { ok: true, id: created.id };
}

export async function saveCategoryDetails(id: string, input: CategoryInput): Promise<Result> {
  await requireAdmin();
  const name = input.name.trim().slice(0, 100);
  if (!name) return { ok: false, error: "El nombre no puede quedar vacío." };
  const parentId = input.parentId || null;
  if (parentId && (await isSelfOrDescendant(id, parentId))) return { ok: false, error: "Una categoría no puede ser hija de sí misma ni de sus subcategorías." };
  const slug = await uniqueSlug(input.slug.trim() || name, async (c) => Boolean(await prisma.category.findFirst({ where: { slug: c, NOT: { id } }, select: { id: true } })));
  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug,
      parentId,
      sortOrder: Math.trunc(Number(input.sortOrder)) || 0,
      description: nul(input.description, 2000),
      comingSoonMessage: input.comingSoonMessage.replace(/<[^>]+>/g, "").trim() ? sanitizeRichHtml(input.comingSoonMessage) : null,
      imageUrl: nul(input.imageUrl),
      seoTitle: nul(input.seoTitle, 120),
      seoDescription: nul(input.seoDescription, 300),
    },
  });
  refresh(id);
  return { ok: true, message: "Categoría guardada." };
}

// Las subcategorías suben al nivel superior y los productos pierden el vínculo con la categoría (no se borran)
export async function deleteCategoryAction(id: string): Promise<Result> {
  await requireAdmin();
  const cat = await prisma.category.findUnique({ where: { id }, select: { name: true } });
  if (!cat) return { ok: true };
  await prisma.category.delete({ where: { id } });
  await logAdminAction("category.delete", { targetType: "category", targetId: id, detail: cat.name });
  refresh();
  return { ok: true };
}
