import { prisma } from "@/lib/prisma";
import { getAllCategories } from "@/lib/categories";
import { SectionSidebar } from "@/components/admin/SectionSidebar";
import { WhatsAppIcon, TagIcon, PlusIcon } from "@/components/icons";
import { createCoupon } from "./actions";
import { CouponFields } from "./CouponFields";
import { QuickCouponGenerator } from "./QuickCouponGenerator";
import { CouponsList, type CouponListItem } from "./CouponsList";
import { couponKind, couponStatus } from "./couponStatus";

function classifyCoupons(coupons: Awaited<ReturnType<typeof prisma.coupon.findMany>>): CouponListItem[] {
  const now = Date.now();
  return coupons.map((coupon) => ({ coupon, kind: couponKind(coupon.code), status: couponStatus(coupon, now) }));
}

export default async function AdminCuponesPage() {
  const [coupons, categories] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    getAllCategories(),
  ]);

  // El tipo y el estado se calculan acá (server) y el listado solo filtra en el navegador
  const items = classifyCoupons(coupons);
  const quickItems = items.filter((i) => i.kind === "quick");

  // --- Tab: Cupones activos (todos, con filtros por tipo y estado) ---
  const listPanel = <CouponsList items={items} categories={categories} />;

  // --- Tab: Nuevo cupón (con condiciones, el form completo) ---
  const newPanel = (
    <form action={createCoupon} className="rounded-xl border border-dashed border-black/20 bg-white p-5">
      <p className="mb-4 font-semibold text-brand-ink">Nuevo cupón</p>
      <CouponFields defaults={null} categories={categories} submitLabel="Crear" />
    </form>
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-brand-ink">Cupones</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Creá códigos de descuento. Todas las condiciones son opcionales: si no cargás ninguna, el cupón aplica a
          cualquier compra.
        </p>
      </div>

      <SectionSidebar
        tabs={[
          {
            id: "rapido",
            label: "Cupón rápido",
            icon: <WhatsAppIcon className="h-4 w-4 shrink-0" />,
            content: (
              <div className="flex flex-col gap-8">
                <QuickCouponGenerator />
                <div>
                  <p className="mb-3 font-semibold text-brand-ink">Cupones rápidos generados</p>
                  <CouponsList items={quickItems} categories={categories} lockedKind="quick" />
                </div>
              </div>
            ),
          },
          {
            id: "activos",
            label: "Cupones activos",
            icon: <TagIcon className="h-4 w-4 shrink-0" />,
            badge: coupons.length > 0 ? String(coupons.length) : undefined,
            content: listPanel,
          },
          { id: "nuevo", label: "Nuevo cupón", icon: <PlusIcon className="h-4 w-4 shrink-0" />, content: newPanel },
        ]}
      />
    </div>
  );
}
