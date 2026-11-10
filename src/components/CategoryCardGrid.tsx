import { CategoryTile } from "@/components/CategoryTile";

export function CategoryCardGrid({
  categories,
}: {
  categories: { id: string; slug: string; name: string; image: string | null }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((cat) => (
        <CategoryTile key={cat.id} slug={cat.slug} name={cat.name} image={cat.image} />
      ))}
    </div>
  );
}
