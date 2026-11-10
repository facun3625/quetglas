import { ShopView } from "@/components/ShopView";

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; etiqueta?: string; ofertas?: string; todos?: string }>;
}) {
  const sp = await searchParams;
  return <ShopView searchParams={sp} />;
}
