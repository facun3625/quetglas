import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TermsManager } from "./TermsManager";

export const dynamic = "force-dynamic";

export default async function AttributePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attr = await prisma.attribute.findUnique({
    where: { id },
    include: { terms: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { variantValues: true } } } }, _count: { select: { products: true } } },
  });
  if (!attr) notFound();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto pb-10">
      <Link href="/admin/atributos" className="text-sm font-medium text-brand-pink-dark hover:underline">← Volver a Atributos</Link>
      <TermsManager
        attribute={{ id: attr.id, name: attr.name, products: attr._count.products }}
        terms={attr.terms.map((t) => ({ id: t.id, name: t.name, colorHex: t.colorHex ?? "", variants: t._count.variantValues }))}
      />
    </div>
  );
}
