import type { Prisma } from "@/generated/prisma/client";

// Un producto se ve en la tienda si está publicado y su programación (publishAt / unpublishAt) lo permite ahora.
export function publishedNow(now = new Date()): Prisma.ProductWhereInput {
  return {
    status: "published",
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ unpublishAt: null }, { unpublishAt: { gt: now } }] },
    ],
  };
}

export function isVisibleNow(p: { status: string; publishAt: Date | null; unpublishAt: Date | null }, now = new Date()): boolean {
  return p.status === "published" && (!p.publishAt || p.publishAt <= now) && (!p.unpublishAt || p.unpublishAt > now);
}
