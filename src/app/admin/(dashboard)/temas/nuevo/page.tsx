import { getAllCategories } from "@/lib/categories";
import { DEFAULT_THEME_CONFIG } from "@/lib/themes";
import { ThemeForm } from "../ThemeForm";

export const dynamic = "force-dynamic";

// No se guarda nada acá: el tema recién se crea cuando el admin toca Guardar en el formulario.
export default async function NewThemePage() {
  const categories = await getAllCategories();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-brand-ink">Crear tema nuevo</h1>
      <ThemeForm
        categories={categories}
        initial={{
          name: "",
          description: "",
          startsAt: "",
          endsAt: "",
          config: DEFAULT_THEME_CONFIG,
        }}
      />
    </div>
  );
}
