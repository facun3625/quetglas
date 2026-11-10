"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/adminLog";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";
import { uniqueSlug } from "@/lib/slug";

export type PageInput = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  enabled: boolean;
  showInFooter: boolean;
  showInMenu: boolean;
  showContactForm: boolean;
  sortOrder: number;
  seoDescription: string;
};

export type PageResult = { ok: true; id: string } | { ok: false; error: string };

export async function savePage(input: PageInput): Promise<PageResult> {
  await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "El título es obligatorio" };
  try {
    const slug = await uniqueSlug(input.slug.trim() || title, async (candidate) =>
      Boolean(await prisma.page.findFirst({ where: { slug: candidate, ...(input.id ? { NOT: { id: input.id } } : {}) }, select: { id: true } }))
    );
    const data = {
      title,
      slug,
      content: sanitizeRichHtml(input.content),
      enabled: input.enabled,
      showInFooter: input.showInFooter,
      showInMenu: input.showInMenu,
      showContactForm: input.showContactForm,
      sortOrder: Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0,
      seoDescription: input.seoDescription.trim().slice(0, 300) || null,
    };
    const page = input.id ? await prisma.page.update({ where: { id: input.id }, data }) : await prisma.page.create({ data });
    await logAdminAction("page.save", { targetType: "page", targetId: page.id, detail: title });
    revalidatePath("/admin/paginas");
    revalidatePath(`/pagina/${slug}`);
    revalidatePath("/", "layout");
    return { ok: true, id: page.id };
  } catch (err) {
    console.error("savePage failed", err);
    return { ok: false, error: "No se pudo guardar la página" };
  }
}

export async function deletePage(id: string) {
  await requireAdmin();
  const page = await prisma.page.delete({ where: { id }, select: { title: true } });
  await logAdminAction("page.delete", { targetType: "page", targetId: id, detail: page.title });
  revalidatePath("/admin/paginas");
  revalidatePath("/", "layout");
}

export async function setMessageRead(id: string, read: boolean) {
  await requireAdmin();
  await prisma.contactMessage.update({ where: { id }, data: { read } });
  revalidatePath("/admin/mensajes");
}

export async function deleteMessage(id: string) {
  await requireAdmin();
  await prisma.contactMessage.delete({ where: { id } });
  revalidatePath("/admin/mensajes");
}
