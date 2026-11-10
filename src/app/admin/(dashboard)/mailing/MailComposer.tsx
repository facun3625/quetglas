"use client";

import { useEffect, useMemo, useState } from "react";
import { buildMailHtml } from "@/lib/mailTemplate";
import { createCampaign, uploadMailImage } from "./actions";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

import { DEFAULT_STORE_NAME } from "@/lib/storeName";
type MailAudience = "abandoned_carts" | "waitlist" | "users" | "subscribers";

const AUDIENCE_OPTIONS: { value: MailAudience; label: string }[] = [
  { value: "abandoned_carts", label: "Carritos abandonados" },
  { value: "waitlist", label: "Lista de espera" },
  { value: "users", label: "Usuarios registrados" },
  { value: "subscribers", label: "Suscriptores al newsletter" },
];

const fieldClasses =
  "w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";
const labelClasses = "mb-1 block text-xs font-medium text-brand-muted";

export function MailComposer({
  audienceCounts,
  segmentCounts,
  franchiseName,
  franchiseLocation,
  logoUrl,
  quotaRemaining,
  footer,
}: {
  audienceCounts: Record<MailAudience, number>;
  segmentCounts: { id: string; name: string; count: number }[];
  franchiseName: string;
  franchiseLocation: string | null;
  logoUrl: string;
  quotaRemaining: number | null;
  footer: {
    address: string | null;
    whatsappNumber: string | null;
    instagramHandle: string | null;
    contactEmail: string | null;
  };
}) {
  const [selected, setSelected] = useState<MailAudience[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fuerza un remount del editor (que es "no controlado" a propósito, ver
  // RichTextEditor) para vaciarlo después de un envío exitoso.
  const [editorKey, setEditorKey] = useState(0);
  // Arranca vacío tanto en el server como en el primer render del cliente
  // (para que coincidan y no rompan la hidratación) — recién después del
  // mount se completa con el origin real del navegador.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const recipientEstimate =
    selected.reduce((sum, a) => sum + (audienceCounts[a] ?? 0), 0) +
    selectedSegments.reduce((sum, id) => sum + (segmentCounts.find((s) => s.id === id)?.count ?? 0), 0);
  // El textarea de antes tenía `required`, que un input hidden no puede
  // reforzar igual (el navegador ignora `required` en hidden) — se chequea
  // a mano para no dejar mandar un mailing con el cuerpo vacío.
  const bodyIsEmpty = !body.replace(/<[^>]*>/g, "").trim() && !/<img\b/i.test(body);

  const previewHtml = useMemo(() => {
    return buildMailHtml({
      logoUrl: /^https?:\/\//i.test(logoUrl) ? logoUrl : `${origin}${logoUrl}`,
      franchiseName: franchiseName || DEFAULT_STORE_NAME,
      franchiseLocation,
      subject: subject || "Asunto del mail",
      title: title || "Título del mail",
      bodyHtml: body || "<p>Acá vas a ver el texto del mail a medida que lo escribís...</p>",
      footer: { ...footer, siteUrl: origin },
    });
  }, [subject, title, body, franchiseName, franchiseLocation, logoUrl, footer, origin]);

  function toggleAudience(value: MailAudience) {
    setSelected((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createCampaign(formData);
    if (!result.ok) {
      setError(result.error ?? "No se pudo enviar el mailing.");
      return;
    }
    setSent(true);
    setSubject("");
    setTitle("");
    setBody("");
    setEditorKey((k) => k + 1);
    setSelected([]);
      setSelectedSegments([]);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <form action={handleSubmit} className="mt-3 grid gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
      <div className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5">
        <div>
          <p className={labelClasses}>Para quién (podés elegir varias)</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    checked ? "border-brand-pink bg-brand-pink/5 text-brand-pink-dark" : "border-black/10 text-brand-ink hover:border-black/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="audiences"
                    value={opt.value}
                    checked={checked}
                    onChange={() => toggleAudience(opt.value)}
                    className="accent-brand-pink"
                  />
                  {opt.label}
                  <span className="text-xs text-brand-muted">({audienceCounts[opt.value] ?? 0})</span>
                </label>
              );
            })}
            {segmentCounts.map((seg) => {
              const checked = selectedSegments.includes(seg.id);
              return (
                <label
                  key={seg.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                    checked ? "border-brand-pink bg-brand-pink/5 text-brand-pink-dark" : "border-dashed border-black/20 text-brand-ink hover:border-black/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="segmentIds"
                    value={seg.id}
                    checked={checked}
                    onChange={() => setSelectedSegments((prev) => (prev.includes(seg.id) ? prev.filter((x) => x !== seg.id) : [...prev, seg.id]))}
                    className="accent-brand-pink"
                  />
                  {seg.name}
                  <span className="text-xs text-brand-muted">({seg.count})</span>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-brand-muted">
            {selected.length === 0 && selectedSegments.length === 0
              ? "Elegí al menos una lista."
              : `Hasta ${recipientEstimate} destinatarios (se sacan los emails duplicados al enviar).`}
          </p>
          {quotaRemaining !== null && recipientEstimate > quotaRemaining && (
            <p className="mt-1.5 text-xs font-medium text-amber-700">
              Esto puede superar tu cupo mensual — quedan {quotaRemaining} (ver pestaña Disponibilidad). Igual se
              puede mandar, es solo un aviso.
            </p>
          )}
        </div>

        <div>
          <label className={labelClasses}>Asunto</label>
          <input
            type="text"
            name="subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Volvió el stock que esperabas ✨"
            className={fieldClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>Título</label>
          <input
            type="text"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="¡Ya está disponible!"
            className={fieldClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>Texto</label>
          <RichTextEditor
            key={editorKey}
            name="body"
            onChange={setBody}
            placeholder="Escribí el mensaje — seleccioná texto para darle formato."
            uploadImage={uploadMailImage}
          />
        </div>

        <div className="flex items-center gap-3 border-t border-black/5 pt-4">
          <button
            type="submit"
            disabled={(selected.length === 0 && selectedSegments.length === 0) || bodyIsEmpty}
            className="rounded-full bg-brand-pink px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar mailing
          </button>
          {sent && <span className="text-sm font-semibold text-green-700">¡Enviando! Mirá el historial abajo.</span>}
          {error && <span className="text-sm font-semibold text-red-700">{error}</span>}
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <p className={labelClasses}>Vista previa</p>
        <div className="overflow-hidden rounded-xl border border-black/10 bg-[#f6f6f6]">
          <iframe title="Vista previa del mailing" srcDoc={previewHtml} className="h-[560px] w-full" />
        </div>
      </div>
    </form>
  );
}
