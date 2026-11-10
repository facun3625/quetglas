import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageForm } from "../PageForm";

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const page = await prisma.page.findUnique({ where: { id: (await params).id } });
  if (!page) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">Editar página</h1>
      <PageForm
        key={page.id}
        initial={{ id: page.id, title: page.title, slug: page.slug, content: page.content, enabled: page.enabled, showInFooter: page.showInFooter, showInMenu: page.showInMenu, showContactForm: page.showContactForm, sortOrder: page.sortOrder, seoDescription: page.seoDescription ?? "" }}
      />
    </div>
  );
}
