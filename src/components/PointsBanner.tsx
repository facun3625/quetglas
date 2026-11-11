import { PointsBannerButton } from "@/components/PointsBannerButton";
import type { PointsBanner as PointsBannerData } from "@/lib/themes";

// Banner del club de puntos, a todo el ancho del inicio. Se arma con textos y colores del tema (Temas → Banner del club
// de puntos), no con una imagen, así se edita sin diseñar nada. Todos los valores vienen ya validados por sanitizeThemeConfig.

const icon = "h-5 w-5";
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={icon} aria-hidden="true">
    <path strokeLinejoin="round" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
  </svg>
);
const TagIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={icon} aria-hidden="true">
    <path strokeLinejoin="round" d="M3.5 12.2V4.5a1 1 0 011-1h7.7a1 1 0 01.7.3l8 8a1 1 0 010 1.4l-7.7 7.7a1 1 0 01-1.4 0l-8-8a1 1 0 01-.3-.7z" />
    <path strokeLinecap="round" d="M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01" />
  </svg>
);
const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={icon} aria-hidden="true">
    <path strokeLinejoin="round" d="M4 11h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9zM3 7.5h18V11H3zM12 7.5V21" />
    <path strokeLinejoin="round" d="M12 7.5S10.5 3 8 3.5 7 7.5 12 7.5zm0 0s1.5-4.5 4-4 1 4-4 4z" />
  </svg>
);
const CartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.2 10.5a1 1 0 001 .8h9.4a1 1 0 001-.8L20 8H6.2M9 20h.01M17 20h.01" />
  </svg>
);
const FEATURE_ICONS = [StarIcon, TagIcon, GiftIcon];

export function PointsBanner({ data }: { data: PointsBannerData }) {
  const { bg, accent } = data;
  const titleLines = data.title ? data.title.split("\n") : [];
  const features = data.features.filter((f) => f.title || f.subtitle);
  const [clubFirst, ...clubRest] = data.clubName.split(" ");

  return (
    <section className="px-3 pb-10 pt-0 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div
          className="relative overflow-hidden rounded-3xl text-white shadow-sm"
          style={{ background: `linear-gradient(115deg, ${bg} 0%, ${bg} 50%, color-mix(in srgb, ${bg} 72%, #000) 100%)` }}
        >
          {/* Decoración suave */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/[0.06]" />
          <div className="pointer-events-none absolute -bottom-28 right-1/3 h-72 w-72 rounded-full bg-white/[0.05]" />

          <div className="relative grid items-center gap-6 p-5 sm:p-8 md:grid-cols-2 md:gap-10">
            {/* Izquierda: el mensaje */}
            <div>
              {data.badge && (
                <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                  {data.badge}
                  <span style={{ color: accent }}><StarIcon /></span>
                </span>
              )}
              {titleLines.length > 0 && (
                <h2 className="font-heading mt-4 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight lg:text-6xl">
                  {titleLines.map((line, i) => (
                    <span key={i} className="block" style={i % 2 === 1 ? { color: accent } : undefined}>
                      {line}
                    </span>
                  ))}
                </h2>
              )}
              {data.ribbon && (
                <p className="mt-3 inline-block -skew-x-6 rounded-md bg-black/30 px-4 py-1.5 text-base font-extrabold uppercase tracking-wide sm:text-xl">
                  <span className="inline-block skew-x-6">{data.ribbon}</span>
                </p>
              )}
              {data.text && <p className="mt-4 max-w-sm text-sm text-white/90 sm:text-base">{data.text}</p>}
              {data.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.image} alt={data.clubName || "Club de puntos"} className="mt-5 hidden max-h-[200px] w-auto object-contain drop-shadow-2xl md:block" loading="lazy" />
              )}
            </div>

            {/* Derecha: el club, sus beneficios y la acción */}
            <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/20 backdrop-blur-sm sm:p-6">
              {data.clubName && (
                <p className="text-2xl uppercase tracking-wide sm:text-3xl">
                  <span className="font-light">{clubFirst}</span>
                  {clubRest.length > 0 && <span className="font-extrabold" style={{ color: accent }}> {clubRest.join(" ")}</span>}
                </p>
              )}
              {features.length > 0 && (
                <ul className={`divide-y divide-white/15 ${data.clubName ? "mt-4" : ""}`}>
                  {features.map((f, i) => {
                    const Icon = FEATURE_ICONS[i] ?? StarIcon;
                    return (
                      <li key={i} className="flex items-center gap-3 py-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30" style={{ color: accent }}>
                          <Icon />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-sm font-bold uppercase">{f.title}</span>
                          {f.subtitle && <span className="block text-xs text-white/75">{f.subtitle}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {data.buttonLabel && (
                <PointsBannerButton label={data.buttonLabel} bg={bg} accent={accent} className="mt-4 w-full justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </PointsBannerButton>
              )}
              {data.footerText && (
                <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
                  <CartIcon />
                  {data.footerText}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
