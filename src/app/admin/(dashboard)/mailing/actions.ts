"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getMailSender } from "@/lib/mailer";
import { marketingMailsLeft, nextResetDate } from "@/lib/usage";
import { buildMailHtml } from "@/lib/mailTemplate";
import { getSegmentEmails } from "@/lib/customers";
import { getAudienceEmails } from "@/lib/audiences";
import type { MailAudience } from "@/generated/prisma/enums";
import { resolveLogos, absoluteUrl } from "@/lib/logo";

import { storeNameOf } from "@/lib/storeName";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "mail");
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Insertada desde el botón de imagen del editor del cuerpo del mail (ver
// RichTextEditor.tsx). Devuelve la URL ABSOLUTA (no relativa) porque el
// <img> queda guardado tal cual dentro del HTML del cuerpo, y ese HTML
// después se manda por mail — un cliente de correo no tiene forma de
// resolver una URL relativa a "este sitio".
export type UploadMailImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadMailImage(formData: FormData): Promise<UploadMailImageResult> {
  await requireAdmin();

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elegí una imagen." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Formato no soportado (usá PNG, JPG, WEBP, GIF o AVIF)." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "La imagen pesa más de 4 MB." };

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return { ok: true, url: `${process.env.NEXTAUTH_URL ?? ""}/api/uploads/mail/${filename}` };
}

// Corre después de que createCampaign ya respondió — no se espera (no
// `await` en el caller). Como el server corre como proceso persistente
// (self-hosted, no serverless) esto sigue ejecutando en segundo plano sin
// problema; si algún día esto corriera en algo tipo Vercel dejaría de
// funcionar así y haría falta una cola de verdad.
async function runCampaign(campaignId: string, emails: string[], subject: string, html: string) {
  const mail = await getMailSender();
  if (!mail) {
    await prisma.mailCampaign.update({
      where: { id: campaignId },
      data: { status: "failed", finishedAt: new Date() },
    });
    return;
  }

  // Si mientras tanto se agotó el cupo mensual, se corta ahí (lo que falta no se manda)
  const left = await marketingMailsLeft();

  let sent = 0;
  for (const email of emails) {
    if (left !== null && sent >= left) break;
    const result = await mail.send(email, subject, html);
    if (!result.ok) console.error("mailing: no se pudo enviar a", email, "—", result.error);
    sent += 1;
    if (sent % 5 === 0 || sent === emails.length) {
      await prisma.mailCampaign.update({ where: { id: campaignId }, data: { sentCount: sent } });
    }
    // no saturar el servidor SMTP (ni parecer spam)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await prisma.mailCampaign.update({
    where: { id: campaignId },
    data: { status: "done", finishedAt: new Date() },
  });
}

export async function createCampaign(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const audiences = formData.getAll("audiences") as MailAudience[];
  const segmentIds = formData.getAll("segmentIds").map(String);

  if (!subject || !title || !body || (audiences.length === 0 && segmentIds.length === 0)) return { ok: false, error: "Completá el asunto, el título, el mensaje y elegí a quién va." };

  const [settings, emails] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: "global" } }),
    getAudienceEmails(audiences).then(async (list) => [...new Set([...list, ...(await getSegmentEmails(segmentIds))])]),
  ]);

  // Cupo mensual (Configuración → Consumo): no se arranca una campaña que no entra en lo que queda del mes
  const left = await marketingMailsLeft();
  if (left !== null && emails.length > left) {
    const resets = nextResetDate().toLocaleDateString("es-AR", { day: "numeric", month: "long" });
    return {
      ok: false,
      error:
        left === 0
          ? `Se agotó el cupo mensual de mails: las campañas vuelven a estar disponibles el ${resets}. Podés subir el cupo en Configuración → Consumo.`
          : `Te quedan ${left} mails este mes y esta campaña tiene ${emails.length} destinatarios. Elegí una lista más chica o subí el cupo en Configuración → Consumo.`,
    };
  }

  const campaign = await prisma.mailCampaign.create({
    data: {
      subject,
      title,
      body,
      audiences,
      segmentIds,
      recipientCount: emails.length,
      status: emails.length > 0 ? "sending" : "done",
      finishedAt: emails.length > 0 ? null : new Date(),
    },
  });

  if (emails.length > 0) {
    const html = buildMailHtml({
      logoUrl: absoluteUrl(resolveLogos(settings ?? {}).header),
      franchiseName: storeNameOf(settings),
      franchiseLocation: settings?.franchiseLocation,
      subject,
      title,
      // HTML enriquecido (negrita, alineación, tamaño, links, imágenes) que
      // arma el RichTextEditor — buildMailHtml lo sanitiza, no lo trata
      // como texto plano a partir en párrafos (eso es solo para el mail de
      // pedido, que sigue siendo texto armado por el server).
      bodyHtml: body,
      footer: {
        address: settings?.address,
        whatsappNumber: settings?.whatsappPhone,
        instagramHandle: settings?.instagramHandle,
        contactEmail: settings?.mailFromEmail,
        siteUrl: process.env.NEXTAUTH_URL,
      },
    });

    runCampaign(campaign.id, emails, subject, html).catch((err) =>
      console.error("mailing: la campaña falló", err)
    );
  }

  revalidatePath("/admin/mailing");
  return { ok: true };
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  await prisma.mailCampaign.delete({ where: { id } });
  revalidatePath("/admin/mailing");
}
