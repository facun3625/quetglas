import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { siteUrl } from "@/lib/siteUrl";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

// Las claves VAPID identifican a ESTA instalación frente a los servicios de
// push de cada navegador (no son secretas del lado del browser: la pública
// viaja tal cual al cliente para poder suscribirse). Se generan solas, una
// sola vez, la primera vez que hacen falta — no hay pantalla de "generar
// claves" en el admin porque no hace falta tocar nada a mano.
async function getOrCreateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const settings = await getStoreSettingsRow();
  if (settings.vapidPublicKey && settings.vapidPrivateKey) {
    return { publicKey: settings.vapidPublicKey, privateKey: settings.vapidPrivateKey };
  }

  const keys = webpush.generateVAPIDKeys();
  // upsert (no update) por si esta es la primera fila de StoreSettings que
  // se crea en la vida de la instalación.
  await prisma.storeSettings.upsert({
    where: { id: "global" },
    create: { id: "global", vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
    update: { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
  });
  return { publicKey: keys.publicKey, privateKey: keys.privateKey };
}

export async function getVapidPublicKey(): Promise<string> {
  const { publicKey } = await getOrCreateVapidKeys();
  return publicKey;
}

async function configuredWebPush(contactEmail: string | null) {
  const { publicKey, privateKey } = await getOrCreateVapidKeys();
  // El contacto del servicio de push: un mail de la tienda o, si no hay, la dirección pública del sitio. Tiene que ser mailto: o
  // https (Apple rechaza "localhost"); en una instalación de prueba con http se usa un mail genérico para que el envío no falle.
  const email = contactEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail) ? contactEmail : null;
  const subject = email ? `mailto:${email}` : siteUrl().startsWith("https://") ? siteUrl() : "mailto:avisos@example.com";
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

// Manda a una lista puntual de suscripciones (filas de PushSubscription) y
// devuelve cuántas salieron bien. Las suscripciones que el navegador ya dio
// de baja (404/410 — desinstaló la app, borró datos del sitio, etc.) se
// eliminan solas: guardarlas no sirve de nada y solo ensucia el conteo de
// "suscriptos" que se muestra en el admin.
async function sendToSubscriptions(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<number> {
  if (subs.length === 0) return 0;

  const settings = await getStoreSettingsRow();
  const push = await configuredWebPush(settings.mailFromEmail || settings.contactEmail);
  const body = JSON.stringify(payload);

  let sent = 0;
  const deadIds: string[] = [];

  for (const sub of subs) {
    try {
      await push.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number } | null)?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        deadIds.push(sub.id);
      } else {
        console.error("webPush: no se pudo enviar a", sub.endpoint, "—", err);
      }
    }
  }

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } });
  }

  return sent;
}

export async function sendPushToAll(payload: PushPayload): Promise<{ total: number; sent: number }> {
  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  const sent = await sendToSubscriptions(subs, payload);
  return { total: subs.length, sent };
}

// Push transaccional a un usuario logueado puntual (ej. "recibimos tu
// pedido", junto con el mail) — a TODOS sus dispositivos suscriptos, no
// solo el que usó para comprar.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;
  await sendToSubscriptions(subs, payload);
}
