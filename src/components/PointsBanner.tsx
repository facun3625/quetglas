import Link from "next/link";
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
  const button = data.buttonLabel && data.buttonHref ? { label: data.buttonLabel, href: data.buttonHref } : null;
  const ButtonTag = button?.href.startsWith("/") ? Link : "a";

  return (
    <section className="px-3 pb-10 pt-0 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div
          className="relative overflow-hidden rounded-3xl text-white shadow-sm"
          style={{ background: `linear-gradient(115deg, ${bg} 0%, ${bg} 50%, color-mix(in srgb, ${bg} 72%, #000) 100%)` }}
        >
          {/* Decoración: franja diagonal más clara a la derecha y círculos suaves */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-white/[0.07] [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)] lg:block" />
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/[0.05]" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-white/[0.04]" />

          <div className="relative grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:gap-6">
            <div>
              {data.badge && (
                <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                  {data.badge}
                  <span style={{ color: accent }}><StarIcon /></span>
                </span>
              )}
              {titleLines.length > 0 && (
                <h2 className="font-heading mt-4 text-5xl font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl">
                  {titleLines.map((line, i) => (
                    <span key={i} className="block" style={i % 2 === 1 ? { color: accent } : undefined}>
                      {line}
                    </span>
                  ))}
                </h2>
              )}
              {data.ribbon && (
                <p className="mt-3 inline-block -skew-x-6 rounded-md bg-black/30 px-5 py-2 text-lg font-extrabold uppercase tracking-wide sm:text-2xl">
                  <span className="inline-block skew-x-6">{data.ribbon}</span>
                </p>
              )}
              {data.text && <p className="mt-4 max-w-md text-base text-white/90 sm:text-lg">{data.text}</p>}

              {features.length > 0 && (
                <ul className="mt-6 grid gap-3 min-[480px]:grid-cols-3">
                  {features.map((f, i) => {
                    const Icon = FEATURE_ICONS[i] ?? StarIcon;
                    return (
                      <li key={i} className="flex items-center gap-2.5">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/35">
                          <Icon />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-xs font-bold uppercase">{f.title}</span>
                          {f.subtitle && <span className="block text-[11px] text-white/75">{f.subtitle}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {button && (
                <ButtonTag
                  href={button.href}
                  className="mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide shadow-md transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: accent, color: bg }}
                >
                  {button.label}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                  </svg>
                </ButtonTag>
              )}
              {data.footerText && (
                <p className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
                  <CartIcon />
                  {data.footerText}
                </p>
              )}
            </div>

            {(data.image || data.clubName) && (
              <div className="flex flex-col items-center gap-6 lg:items-end">
                {data.clubName && (
                  <p className="text-3xl uppercase tracking-wide sm:text-4xl">
                    <span className="font-light">{clubFirst}</span>
                    {clubRest.length > 0 && <span className="font-extrabold" style={{ color: accent }}> {clubRest.join(" ")}</span>}
                  </p>
                )}
                {data.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.image} alt={data.clubName || "Club de puntos"} className="max-h-[340px] w-auto max-w-full object-contain drop-shadow-2xl" loading="lazy" />
                ) : (
                  <div className="hidden items-center gap-5 lg:flex" aria-hidden="true">
                    {FEATURE_ICONS.map((Icon, i) => (
                      <span key={i} className={`flex items-center justify-center rounded-full bg-white/10 ring-1 ring-white/25 [&_svg]:h-9 [&_svg]:w-9 ${i === 1 ? "h-24 w-24 -translate-y-4" : "h-20 w-20"}`}>
                        <Icon />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
