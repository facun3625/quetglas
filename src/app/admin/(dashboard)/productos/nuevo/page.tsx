import { getStoreSettingsRow } from "@/lib/settings";
import { ProductForm } from "../ProductForm";
import { EMPTY_PRODUCT, getFormOptions } from "../formData";

export default async function NewProductPage() {
  const [options, { currency }] = await Promise.all([getFormOptions(), getStoreSettingsRow()]);
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">Nuevo producto</h1>
      <ProductForm initial={EMPTY_PRODUCT} {...options} currency={currency} relatedNames={{}} />
    </div>
  );
}
