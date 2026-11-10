"use client";

// Carga y wrappea el SDK de tokenización de Payway (decidir.js) — corre
// 100% en el navegador, nunca vemos el número de tarjeta en nuestro server.
// Mismas URLs base que lib/payway.ts (server-side) para cobrar.

const SCRIPT_URL = "https://ventasonline.payway.com.ar/static/v2.6.4/decidir.js";
const SANDBOX_API_URL = "https://developers.decidir.com/api/v2";
const PRODUCTION_API_URL = "https://ventasonline.payway.com.ar/api/v2";

type DecidirInstance = {
  setPublishableKey: (key: string) => void;
  setTimeout: (ms: number) => void;
  createToken: (form: HTMLFormElement, callback: (status: number, response: Record<string, unknown>) => void) => void;
};

declare global {
  interface Window {
    Decidir?: new (url: string) => DecidirInstance;
  }
}

let loadPromise: Promise<void> | null = null;

function loadDecidirScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Solo funciona en el navegador"));
  if (window.Decidir) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el sistema de pago con tarjeta"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function tokenizeCard(
  form: HTMLFormElement,
  opts: { publicKey: string; sandbox: boolean }
): Promise<{ token: string }> {
  await loadDecidirScript();
  if (!window.Decidir) throw new Error("No se pudo cargar el sistema de pago con tarjeta");

  const decidir = new window.Decidir(opts.sandbox ? SANDBOX_API_URL : PRODUCTION_API_URL);
  decidir.setPublishableKey(opts.publicKey);
  decidir.setTimeout(8000);

  return new Promise((resolve, reject) => {
    decidir.createToken(form, (status, response) => {
      if (status === 200 || status === 201) {
        resolve(response as { token: string });
      } else {
        const errors = response?.error as { message?: string }[] | undefined;
        const message = errors?.[0]?.message || (response?.message as string) || "No se pudo validar la tarjeta";
        reject(new Error(message));
      }
    });
  });
}
