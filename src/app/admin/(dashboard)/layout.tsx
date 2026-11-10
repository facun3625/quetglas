import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { requireAdmin } from "@/lib/adminAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getStoreSettingsRow } from "@/lib/settings";
import { resolveLogos } from "@/lib/logo";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { getAdminCounts } from "@/lib/adminCounts";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", weight: ["300", "400", "500", "600"] });

export default async function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "Admin";
  const [settings, counts] = await Promise.all([getStoreSettingsRow(), getAdminCounts()]);
  const logoUrl = resolveLogos(settings).header;

  return (
    <div className={`admin-panel ${montserrat.variable} flex h-[100dvh] flex-col overflow-hidden bg-white md:flex-row`}>
      <AdminSidebar userLabel={userLabel} logoUrl={logoUrl} counts={counts} isSuper={session?.user?.role === "superadmin"} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminTopBar name={session?.user?.name ?? ""} email={session?.user?.email ?? ""} role={session?.user?.role ?? "admin"} counts={counts} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-4 py-5 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
