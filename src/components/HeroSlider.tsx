"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export type HeroSlide = {
  image: string; // imagen del slide; si tiene video, es su portada (carga mientras llega el video y en el celular)
  videoUrl?: string | null;
  eyebrow: string;
  title: string; // hasta 2 líneas separadas por \n
  subtitle?: string | null;
  promoText?: string | null; // hasta 2 líneas separadas por \n
  buttons: { label: string; href: string }[];
};

// El video se reproduce en silencio y en bucle. En el celular (o con "reducir movimiento") se usa la imagen de portada del
// slide, si la tiene, para ahorrar datos. Se decide recién en el navegador, así el video no se descarga de más.
function useAllowVideo(hasPoster: boolean): boolean {
  const [allow, setAllow] = useState(false);
  useEffect(() => {
    const small = window.matchMedia("(max-width: 639px)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAllow(!(hasPoster && (small || reduced)));
  }, [hasPoster]);
  return allow;
}

export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[index];
  const allowVideo = useAllowVideo(Boolean(slide?.image));
  // Si el video no se puede reproducir (enlace caído, formato raro), queda la imagen del slide
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  if (!slide) return null;

  const titleLines = slide.title.split("\n");
  const promoLines = slide.promoText?.split("\n") ?? [];
  // El círculo crece (círculo + tipografía) según cuánto texto se cargue,
  // hasta un tope — así una frase larga (ej. "Descuento 10% en
  // transferencias") entra cómoda sin desbordar ni quedar ilegible.
  const promoTotalLength = promoLines.reduce((sum, l) => sum + l.length, 0);
  const promoSize =
    promoTotalLength > 26
      ? { circle: "h-28 w-28 sm:h-36 sm:w-36", text: "text-[9px] sm:text-xs" }
      : promoTotalLength > 14
        ? { circle: "h-24 w-24 sm:h-32 sm:w-32", text: "text-[9px] sm:text-[11px]" }
        : { circle: "h-20 w-20 sm:h-28 sm:w-28", text: "text-[10px] sm:text-xs" };

  return (
    <div className="relative flex min-h-[320px] items-center rounded-3xl sm:min-h-[400px]">
      {/* La imagen y su degradé van en un wrapper propio con overflow-hidden
          para respetar el rounded-3xl — el círculo de promo queda AFUERA de
          este wrapper para poder "asomarse" un poco por el borde. */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <AnimatePresence>
          <motion.div
            key={`bg-${index}`}
            className="absolute inset-0 bg-cover bg-center"
            style={slide.image ? { backgroundImage: `url(${slide.image})` } : { backgroundColor: "#111" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {slide.videoUrl && allowVideo && failedVideo !== slide.videoUrl && (
              <video
                key={slide.videoUrl}
                className="absolute inset-0 h-full w-full object-cover"
                src={slide.videoUrl}
                poster={slide.image || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                onError={() => setFailedVideo(slide.videoUrl ?? null)}
              />
            )}
          </motion.div>
        </AnimatePresence>
        {/* Oscurece la izquierda (donde va el texto) y deja la foto a la
            vista del lado derecho — la imagen cubre TODO el banner. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
      </div>

      {promoLines.length > 0 && (
        <div
          className={`absolute -right-2 -top-2 z-20 flex shrink-0 rotate-6 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full border-[3px] border-brand-pink bg-white p-3 text-center sm:border-4 sm:p-5 font-heading font-bold uppercase leading-tight text-wrap break-words text-brand-pink shadow-lg sm:-right-3 sm:-top-3 ${promoSize.circle} ${promoSize.text}`}
        >
          {promoLines.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      )}

      <div className="relative z-10 flex h-full w-full flex-col justify-center px-8 py-10 pr-24 sm:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="max-w-lg"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/90 sm:text-sm">
              {slide.eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              {titleLines.map((line, i) => (
                <span key={i} className={`block ${i % 2 === 1 ? "text-brand-pink" : "text-white"}`}>
                  {line}
                </span>
              ))}
            </h1>
            {slide.subtitle && <p className="mt-4 text-sm text-white/90 sm:text-base">{slide.subtitle}</p>}

            {slide.buttons.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {slide.buttons.map((btn, i) => (
                  <Link
                    key={i}
                    href={btn.href}
                    className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
                      i === 0
                        ? "bg-brand-pink text-white hover:bg-brand-pink-dark"
                        : "border border-white/70 text-white hover:bg-white hover:text-brand-pink-dark"
                    }`}
                  >
                    {btn.label}
                    {i === 0 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {slides.length > 1 && (
          <div className="mt-8 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-white ${
                  i === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {slides.length > 1 && (
        <>
          <button
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            aria-label="Slide anterior"
            className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            aria-label="Slide siguiente"
            className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white outline-none backdrop-blur-sm transition-colors hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white sm:flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
