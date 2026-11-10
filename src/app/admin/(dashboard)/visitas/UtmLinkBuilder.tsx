"use client";

import { useMemo, useState } from "react";

// Arma un link de la tienda con su origen (UTM) para pegar en la bio de Instagram, un anuncio, un mail o un mensaje de WhatsApp.
// Así Visitas puede distinguir, por ejemplo, el link de la bio (orgánico) del de un anuncio pago.
const SOURCES = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "email", label: "Email / newsletter" },
  { value: "google", label: "Google" },
  { value: "otro", label: "Otro" },
];
const MEDIUMS = [
  { value: "bio", label: "Link de la bio / perfil" },
  { value: "post", label: "Publicación o historia (orgánico)" },
  { value: "cpc", label: "Anuncio pago" },
  { value: "email", label: "Mail" },
  { value: "mensaje", label: "Mensaje directo" },
];

const field = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-ink focus:border-brand-pink focus:outline-none";

export function UtmLinkBuilder({ siteUrl }: { siteUrl: string }) {
  const [path, setPath] = useState("/");
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("bio");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const link = useMemo(() => {
    const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
    const url = new URL((path.startsWith("/") ? path : `/${path}`) || "/", siteUrl);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", medium);
    if (clean(campaign)) url.searchParams.set("utm_campaign", clean(campaign));
    return url.toString();
  }, [path, source, medium, campaign, siteUrl]);

  return (
    <div className="rounded-xl border border-black/10 bg-white p-5">
      <p className="text-sm font-semibold text-brand-ink">Armá un link con origen</p>
      <p className="mt-0.5 max-w-3xl text-xs text-brand-muted">
        Las redes no siempre avisan de dónde viene cada visita. Si usás este link en tu bio, tus anuncios o tus mails, Visitas lo cuenta en el origen que elijas (y separa lo orgánico de lo pago).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-brand-muted">Página de la tienda</label>
          <input className={field} value={path} onChange={(e) => setPath(e.target.value)} placeholder="/ o /tienda o /producto/…" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-brand-muted">Dónde lo vas a poner</label>
          <select className={field} value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-brand-muted">Tipo</label>
          <select className={field} value={medium} onChange={(e) => setMedium(e.target.value)}>
            {MEDIUMS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-brand-muted">Campaña (opcional)</label>
          <input className={field} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="ej: dia-de-la-madre" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 font-mono text-xs`} aria-label="Link con origen" />
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
          }}
          className="cursor-pointer rounded-lg bg-brand-pink px-4 py-2 text-xs font-semibold text-white hover:bg-brand-pink-dark"
        >
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}
