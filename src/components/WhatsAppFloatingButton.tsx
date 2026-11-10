import { WhatsAppIcon } from "@/components/icons";
import type { SiteSettings } from "@/lib/settings";

// Reemplaza a <SalesAssistant> (misma posición/tamaño de burbuja) mientras
// la vendedora IA está apagada o sin configurar — ver SiteChrome. Así la
// tienda siempre tiene una vía de contacto directa en la esquina, sea cual
// sea el estado de la IA.
export function WhatsAppFloatingButton({ humanSeller }: { humanSeller: SiteSettings["assistant"]["humanSeller"] }) {
  if (!humanSeller.enabled) return null;

  if (humanSeller.available && humanSeller.whatsappUrl) {
    return (
      <a
        href={humanSeller.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
        className="fixed bottom-5 right-4 z-50 flex h-12 items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 text-white shadow-lg transition-transform hover:scale-105 sm:right-5"
      >
        <WhatsAppIcon className="h-5 w-5" />
        <span className="text-xs font-semibold">Escribinos</span>
      </a>
    );
  }

  return (
    <div
      title={`Atención por WhatsApp: ${humanSeller.scheduleText}`}
      className="fixed bottom-5 right-4 z-50 flex h-12 cursor-default items-center gap-1.5 rounded-full bg-[#25D366]/50 px-3.5 text-white shadow-lg sm:right-5"
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span className="text-xs font-semibold">Fuera de horario</span>
    </div>
  );
}
