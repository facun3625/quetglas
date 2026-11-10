import { TagIcon, TruckIcon, StoreIcon, getBenefitIcon } from "@/components/icons";
import { resolveBenefitIcon, type HomeBenefit } from "@/lib/benefitIcons";
import type { SiteSettings } from "@/lib/settings";

type Benefit = { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; title: string; subtitle: string };

// Las tarjetas se reparten el ancho: hasta 4 por fila (con 5 o 6 quedan 3 por fila)
const COLS = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4", "sm:grid-cols-3", "sm:grid-cols-3"];

// Franja de beneficios debajo del hero. La arma el admin desde Configuración → Franja de beneficios (1 a 6 ítems, con ícono,
// título y subtítulo). Mientras no la haya armado, se muestran los 3 de siempre, calculados con datos reales de la tienda
// (descuento en efectivo, zona de envío, dirección) y pisables uno por uno (`overrides`).
export function BenefitsStrip({
  cashDiscountPct,
  franchiseLocation,
  address,
  overrides,
  items,
}: {
  cashDiscountPct: number | null;
  franchiseLocation: string;
  address: string;
  overrides: SiteSettings["benefits"];
  items?: HomeBenefit[];
}) {
  let benefits: Benefit[];
  if (items && items.length > 0) {
    benefits = items.map((b) => ({ icon: resolveBenefitIcon(b.icon).Icon as Benefit["icon"], title: b.title, subtitle: b.subtitle }));
  } else {
    const defaults: Benefit[] = [
      cashDiscountPct
        ? { icon: TagIcon, title: `${cashDiscountPct}% OFF pagando en efectivo`, subtitle: "En toda la tienda" }
        : { icon: TagIcon, title: "Múltiples medios de pago", subtitle: "Efectivo, transferencia y tarjeta" },
      { icon: TruckIcon, title: `Envíos a ${franchiseLocation}`, subtitle: "Rápidos y seguros" },
      { icon: StoreIcon, title: "Retiro en local", subtitle: address },
    ];
    benefits = defaults.map((def, i) => {
      const o = overrides[i];
      return {
        icon: o?.icon ? getBenefitIcon(o.icon) : def.icon,
        title: o?.title?.trim() || def.title,
        subtitle: o?.subtitle?.trim() || def.subtitle,
      };
    });
  }

  return (
    <div className={`grid grid-cols-1 gap-x-6 gap-y-4 rounded-b-3xl border-x border-b border-black/5 bg-white px-4 py-5 shadow-sm sm:px-6 ${COLS[Math.min(benefits.length, 6)]}`}>
      {benefits.map((b, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-pink-dark shadow-sm">
            <b.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-brand-ink">{b.title}</p>
            {b.subtitle && <p className="text-xs leading-snug text-brand-muted">{b.subtitle}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
