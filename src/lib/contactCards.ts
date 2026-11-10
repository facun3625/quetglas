import { prisma } from "@/lib/prisma";

// Tarjetas de "Datos de contacto" (se arman desde el panel, en Contacto)
export type PublicContactCard = {
  id: string;
  title: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
};

export async function getContactCards(): Promise<PublicContactCard[]> {
  const cards = await prisma.contactCard.findMany({ where: { enabled: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return cards.map(({ id, title, address, phone, whatsapp, instagram }) => ({ id, title, address, phone, whatsapp, instagram }));
}
