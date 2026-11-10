// Celda "WhatsApp" de las listas de contacto: cuándo se le escribió por última vez (hora argentina) y cuántas veces.
const TZ = "America/Argentina/Buenos_Aires";

export function WhatsAppSentCell({ date, count }: { date: Date | null; count: number }) {
  if (!date) return <span className="text-brand-muted">Sin enviar</span>;
  const day = date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });
  const hour = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return (
    <div>
      <p className="font-medium text-green-700">Enviado</p>
      <p className="text-brand-muted">
        {day} · {hour}
        {count > 1 ? ` · ${count} veces` : ""}
      </p>
    </div>
  );
}
