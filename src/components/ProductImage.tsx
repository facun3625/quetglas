"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ZoomIcon } from "@/components/icons";

export function ProductImage({
  productId,
  thumbnail,
  alt,
}: {
  productId: string;
  thumbnail: string | null;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (!thumbnail) return;
    setOpen(true);
    if (!fullImage) {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();
        setFullImage(data.images?.[0]?.url || thumbnail);
      } catch {
        setFullImage(thumbnail);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="group/image relative mb-3 block aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg bg-brand-soft"
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={alt}
            className="h-full w-full object-cover transition-transform group-hover/image:scale-[1.03]"
          />
        ) : null}

        {thumbnail && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/image:bg-black/15 group-hover/image:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow">
              <ZoomIcon className="h-3.5 w-3.5" />
              Ampliar imagen
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
              onClick={() => setOpen(false)}
            >
              <motion.div
                key="panel"
                className="relative max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[85vh] sm:max-w-[85vw]"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-brand-ink shadow hover:bg-brand-soft"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>

                <div className="flex h-[min(calc(100dvh-1.5rem),500px)] w-[min(calc(100vw-1.5rem),500px)] items-center justify-center sm:h-[min(85vh,500px)] sm:w-[min(85vw,500px)]">
                  {loading ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-pink border-t-transparent" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fullImage ?? undefined}
                      alt={alt}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
