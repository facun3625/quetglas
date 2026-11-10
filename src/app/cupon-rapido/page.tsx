import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff, isCouponStaff } from "@/lib/roles";
import { getStoreSettingsRow } from "@/lib/settings";
import { resolveLogos } from "@/lib/logo";
import { storeNameOf } from "@/lib/storeName";
import { QuickCouponGenerator } from "@/app/admin/(dashboard)/cupones/QuickCouponGenerator";
import { SignOutButton } from "./SignOutButton";

// Pantalla única para la cuenta genérica de sucursal (rol couponStaff): nada
// de panel, nada de lista de cupones — solo generar uno nuevo y mandarlo por
// WhatsApp. proxy.ts ya encierra a ese rol acá; esta página solo valida que
// quien entra tenga permiso (couponStaff, o un admin/superadmin de verdad).
export default async function CuponRapidoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isCouponStaff(session.user.role) && !isStaff(session.user.role)) redirect("/");

  const settings = await getStoreSettingsRow();
  const { header: logo } = resolveLogos(settings);
  const name = storeNameOf(settings);

  return (
    <div className="flex min-h-screen flex-col bg-brand-soft/40">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={name} className="h-8 w-auto object-contain" />
        <SignOutButton />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <QuickCouponGenerator />
      </main>
    </div>
  );
}
