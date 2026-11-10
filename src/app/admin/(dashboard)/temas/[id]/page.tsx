import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { sanitizeThemeConfig } from "@/lib/themes";
import { ThemeForm } from "../ThemeForm";

export const dynamic = "force-dynamic";

export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  const [theme, categories] = await Promise.all([
    prisma.theme.findUnique({ where: { id: (await params).id } }),
    getAllCategories(),
  ]);
  if (!theme) notFound();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">{theme.isBase ? "Editar el aspecto base de la tienda" : "Editar tema"}</h1>
      {theme.isBase && <p className="-mt-4 mb-6 max-w-2xl text-sm text-brand-muted">Este es el aspecto que ven tus clientes cuando no hay ninguna campaña activa. Los cambios se aplican apenas guardás.</p>}
      <ThemeForm
        isBase={theme.isBase}
        key={theme.id}
        categories={categories}
        initial={{
          id: theme.id,
          name: theme.name,
          description: theme.description ?? "",
          startsAt: theme.startsAt?.toISOString() ?? "",
          endsAt: theme.endsAt?.toISOString() ?? "",
          config: sanitizeThemeConfig(theme.config),
        }}
      />
    </div>
  );
}
