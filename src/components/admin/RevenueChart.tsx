// Barra SVG casera (sin librería de gráficos) — se genera server-side, el
// tooltip nativo (<title>) alcanza para ver el valor exacto al pasar el mouse.
import { formatMoneyWith, type CurrencyCode } from "@/lib/money";

export function RevenueChart({ data, currency }: { data: { date: string; total: number }[]; currency: CurrencyCode }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const hasSales = data.some((d) => d.total > 0);
  const width = 700;
  const height = 150;
  const gap = 6;
  const barWidth = (width - gap * (data.length - 1)) / data.length;

  return (
    <div className="relative overflow-x-auto">
      {!hasSales && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-brand-muted">
          Todavía no hay ventas confirmadas en este período.
        </p>
      )}
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        preserveAspectRatio="none"
        className="h-40 w-full"
        style={{ minWidth: 520 }}
      >
        {data.map((d, i) => {
          const barHeight = d.total > 0 ? Math.max(3, (d.total / max) * height) : 1.5;
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          const dateObj = new Date(`${d.date}T00:00:00`);
          const label = dateObj.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={3}
                className={d.total > 0 ? "fill-brand-pink transition-opacity hover:opacity-70" : "fill-black/10"}
              >
                <title>{`${label}: ${formatMoneyWith(d.total, currency)}`}</title>
              </rect>
              {i % 2 === 0 && (
                <text x={x + barWidth / 2} y={height + 15} textAnchor="middle" fontSize="9" className="fill-brand-muted">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
