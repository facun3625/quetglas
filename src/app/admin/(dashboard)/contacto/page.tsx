import { prisma } from "@/lib/prisma";
import { ContactCardForm } from "./ContactCardForm";

export const dynamic = "force-dynamic";

export default async function ContactoPage() {
  const cards = await prisma.contactCard.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] });

  return (
    <div className="max-w-3xl pb-16">
      <h1 className="text-2xl font-bold text-brand-ink">Datos de contacto</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Armá las tarjetas que se muestran abajo en el sitio, antes del pie de página (una por local, rubro o sucursal): título, dirección,
        teléfono, WhatsApp e Instagram. Se reparten el ancho en hasta 4 columnas, y el enlace <b>Contacto</b> del menú lleva hasta ahí. Si no
        cargás ninguna, la sección no se muestra.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {cards.map((c, i) => (
          <ContactCardForm
            key={c.id + c.updatedAt.getTime()}
            initial={{ id: c.id, title: c.title, address: c.address ?? "", phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", instagram: c.instagram ?? "", enabled: c.enabled }}
            canUp={i > 0}
            canDown={i < cards.length - 1}
          />
        ))}
        {cards.length === 0 && <p className="rounded-xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-brand-muted">Todavía no cargaste ninguna tarjeta.</p>}
      </div>

      <h2 className="mb-3 mt-10 font-semibold text-brand-ink">Nueva tarjeta</h2>
      <ContactCardForm initial={{ title: "", address: "", phone: "", whatsapp: "", instagram: "", enabled: true }} />
    </div>
  );
}
