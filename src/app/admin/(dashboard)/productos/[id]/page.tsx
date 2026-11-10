import { notFound } from "next/navigation";
import { getStoreSettingsRow } from "@/lib/settings";
import { ProductForm } from "../ProductForm";
import { getFormOptions, getProductForEdit, getRelatedNames } from "../formData";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, options, { currency }] = await Promise.all([getProductForEdit(id), getFormOptions(), getStoreSettingsRow()]);
  if (!product) notFound();
  const relatedNames = await getRelatedNames(product.relatedIds);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">Editar producto</h1>
      <ProductForm key={product.id} initial={product} {...options} currency={currency} relatedNames={relatedNames} />
    </div>
  );
}
