import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddressList } from "./AddressList";

export default async function MisDireccionesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-brand-ink">Mis direcciones</h1>
        <p className="mt-2 text-brand-muted">Iniciá sesión para ver tus direcciones guardadas.</p>
      </div>
    );
  }

  const addresses = await prisma.address.findMany({ where: { userId: session.user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });

  return (
    <div className="mx-auto max-w-3xl px-3 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold text-brand-ink">Mis direcciones</h1>
      <p className="mt-1 text-brand-muted">Las usás para completar el envío más rápido. Para agregar una nueva, tildá “Guardar esta dirección” al comprar.</p>
      {addresses.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
          <p className="text-brand-muted">Todavía no guardaste ninguna dirección.</p>
          <Link href="/tienda" className="mt-4 inline-block rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-pink-dark">
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <AddressList addresses={addresses.map((a) => ({ id: a.id, street: a.street, number: a.number, apartment: a.apartment, city: a.city, province: a.province, zipCode: a.zipCode, isDefault: a.isDefault }))} />
      )}
    </div>
  );
}
