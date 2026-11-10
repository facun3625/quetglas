// Sin dependencias de servidor a propósito: este mismo builder se usa tanto
// al mandar el mail de verdad (lib/mailer.ts) como en la vista previa en
// vivo del admin (un client component), para que lo que se ve en pantalla
// sea exactamente lo que se manda.

import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#383e45;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`
    )
    .join("");
}

// Envoltorio con la tipografía/color base del mail — igual que paragraphs(),
// pero para HTML ya armado (negrita, alineación, links, imágenes) en vez de
// texto plano a partir en párrafos.
function richBody(html: string): string {
  const clean = sanitizeRichHtml(html).trim();
  if (!clean) return "";
  return `<div style="font-size:15px;line-height:1.65;color:#383e45;">${clean}</div>`;
}

// Solo linkea si hay algo que armar — nunca inventa un handle/URL que no
// esté cargado en Configuración.
function siteLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `<a href="${escapeHtml(url)}" style="color:#c4161a;text-decoration:none;font-weight:600;">${escapeHtml(clean)}</a>`;
}

function instagramLink(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const clean = handle.replace(/^@/, "");
  return `<a href="https://instagram.com/${encodeURIComponent(clean)}" style="color:#c4161a;text-decoration:none;font-weight:600;">@${escapeHtml(clean)}</a>`;
}

export type MailTemplateData = {
  logoUrl: string;
  franchiseName: string;
  franchiseLocation?: string | null;
  subject: string;
  title: string;
  // Exactamente uno de los dos: `body` es texto plano (se parte en párrafos
  // por línea en blanco — lo usa el mail de pedido, armado por el server).
  // `bodyHtml` es HTML enriquecido (negrita, alineación, links, imágenes) —
  // lo usa Mailing, armado por el RichTextEditor del admin.
  body?: string;
  bodyHtml?: string;
  // Botón de acción debajo del texto (ej. "Completar mi compra")
  cta?: { label: string; url: string };
  // Línea chica al final (ej. el link para no recibir más avisos)
  footerNote?: { text: string; linkLabel: string; linkUrl: string };
  footer: {
    address?: string | null;
    whatsappNumber?: string | null;
    instagramHandle?: string | null;
    contactEmail?: string | null;
    siteUrl?: string | null;
  };
};

export function buildMailHtml(data: MailTemplateData): string {
  const { logoUrl, franchiseName, franchiseLocation, title, footer } = data;
  const bodyContent = data.bodyHtml ? richBody(data.bodyHtml) : paragraphs(data.body ?? "");

  const footerLinks = [siteLink(footer.siteUrl), instagramLink(footer.instagramHandle), footer.contactEmail ? escapeHtml(footer.contactEmail) : null]
    .filter(Boolean)
    .join(`<span style="color:#d8c9ce;"> · </span>`);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:28px 14px 36px;">
      <div style="text-align:center;padding:8px 0 24px;">
        <img src="${logoUrl}" alt="${escapeHtml(franchiseName)}" style="height:64px;" />
        <p style="margin:12px 0 0;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#c4161a;">
          ${escapeHtml(franchiseName)}${franchiseLocation ? ` · ${escapeHtml(franchiseLocation)}` : ""}
        </p>
      </div>

      <div style="height:1px;background:#e8e5e6;"></div>

      <div style="padding:32px 4px;">
        <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;color:#2a1f24;">${escapeHtml(title)}</h1>
        ${bodyContent}
        ${
          data.cta
            ? `<p style="margin:8px 0 0;text-align:center;"><a href="${escapeHtml(data.cta.url)}" style="display:inline-block;background:#c4161a;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;">${escapeHtml(data.cta.label)}</a></p>`
            : ""
        }
      </div>

      <div style="height:1px;background:#e8e5e6;"></div>

      <div style="text-align:center;padding:28px 12px 4px;">
        <p style="margin:0 0 10px;font-size:20px;color:#f06292;">✦</p>
        ${footer.address ? `<p style="margin:0 0 4px;font-size:12.5px;color:#8a7580;">${escapeHtml(footer.address)}</p>` : ""}
        ${footerLinks ? `<p style="margin:0;font-size:12.5px;color:#8a7580;">${footerLinks}</p>` : ""}
        ${footer.whatsappNumber ? `<p style="margin:8px 0 0;font-size:12.5px;color:#8a7580;">WhatsApp: ${escapeHtml(footer.whatsappNumber)}</p>` : ""}
        ${data.footerNote ? `<p style="margin:14px 0 0;font-size:11.5px;color:#a89aa0;">${escapeHtml(data.footerNote.text)} <a href="${escapeHtml(data.footerNote.linkUrl)}" style="color:#a89aa0;text-decoration:underline;">${escapeHtml(data.footerNote.linkLabel)}</a></p>` : ""}
      </div>
    </div>
  </body>
</html>`;
}
