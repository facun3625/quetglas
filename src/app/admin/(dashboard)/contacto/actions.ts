"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export type ContactCardInput = { id?: string; title: string; address: string; phone: string; whatsapp: string; instagram: string; enabled: boolean };

const clean = (v: string, max: number) => v.trim().slice(0, max) || null;

function refresh() {
  revalidatePath("/admin/contacto");
  revalidatePath("/", "layout");
}

export async function saveContactCard(input: ContactCardInput): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const title = input.title.trim().slice(0, 60);
  if (!title) return { ok: false, error: "Poné un título (por ejemplo, el rubro o la sucursal)" };
  const data = {
    title,
    address: clean(input.address, 120),
    phone: clean(input.phone, 40),
    whatsapp: clean(input.whatsapp, 40),
    instagram: clean(input.instagram, 100),
    enabled: input.enabled,
  };
  if (input.id) {
    await prisma.contactCard.update({ where: { id: input.id }, data });
  } else {
    const last = await prisma.contactCard.aggregate({ _max: { position: true } });
    await prisma.contactCard.create({ data: { ...data, position: (last._max.position ?? -1) + 1 } });
  }
  refresh();
  return { ok: true };
}

export async function deleteContactCard(id: string) {
  await requireAdmin();
  await prisma.contactCard.deleteMany({ where: { id } });
  refresh();
}

// Sube o baja una tarjeta en el orden (renumera todas para que el orden quede siempre limpio)
export async function moveContactCard(id: string, direction: "up" | "down") {
  await requireAdmin();
  const cards = await prisma.contactCard.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const from = cards.findIndex((c) => c.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= cards.length) return;
  [cards[from], cards[to]] = [cards[to], cards[from]];
  await prisma.$transaction(cards.map((c, position) => prisma.contactCard.update({ where: { id: c.id }, data: { position } })));
  refresh();
}
