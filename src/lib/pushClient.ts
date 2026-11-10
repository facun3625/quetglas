// Suscripción a las notificaciones push desde el navegador (lo usan el botón "Descargar Web App" y el aviso dentro de la app instalada).

// La Push API pide la VAPID public key como ArrayBuffer — conversión estándar del formato base64url en que se guarda/expone.
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function saveSubscription(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey) });
  }
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  }).catch(() => {});
}

async function fetchPublicKey(): Promise<string | null> {
  const response = await fetch("/api/push/public-key", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  return ((await response.json()) as { publicKey?: string }).publicKey ?? null;
}

// Pide el permiso (tiene que venir de un toque del usuario) y deja la suscripción guardada. Devuelve si quedó activa.
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  const key = await fetchPublicKey();
  if (!key) return false;
  await saveSubscription(key);
  return true;
}

// Si el permiso ya estaba dado, vuelve a registrar la suscripción (por si el navegador la renovó o ahora hay sesión iniciada)
export async function resyncPush(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const key = await fetchPublicKey();
  if (key) await saveSubscription(key).catch(() => {});
}
