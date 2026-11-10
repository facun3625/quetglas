import { redirect } from "next/navigation";

// La configuración técnica (IA y correo) ahora vive en el panel: Configuración → Vendedora IA / Correo.
export default function IntegracionesPage() {
  redirect("/admin/configuracion");
}
