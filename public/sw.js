// A propósito sin manejar "fetch" — eso lo volvería offline-first, con
// riesgo de mostrar catálogo/stock viejo como si fuera actual. Este service
// worker existe solo para dos cosas: que Chrome considere el sitio
// instalable, y poder recibir notificaciones push (que necesitan sí o sí un
// service worker activo, incluso con la app cerrada).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Tienda", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Tienda", {
      body: payload.body || "",
      icon: "/icons/app/192.png",
      badge: "/icons/app/192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // El enlace llega relativo ("/producto/..."): se compara y se abre siempre con la dirección completa
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Si la tienda ya está abierta, se usa esa ventana y se la lleva al enlace
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then((focused) => (focused && "navigate" in focused && focused.url !== target ? focused.navigate(target) : focused));
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
