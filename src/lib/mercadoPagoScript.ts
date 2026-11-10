"use client";

// Carga y wrappea el SDK de Mercado Pago (sdk.mercadopago.com/js/v2) — corre
// 100% en el navegador, nunca vemos el número de tarjeta en nuestro server.
//
// A diferencia de decidir.js (Payway), que lee un <form> del DOM, esta SDK
// recibe un objeto JS común — confirmado leyendo el archivo fuente real del
// SDK, no solo la documentación.

const SCRIPT_URL = "https://sdk.mercadopago.com/js/v2";

type MercadoPagoInstance = {
  createCardToken: (data: {
    cardNumber: string;
    cardholderName: string;
    identificationType: string;
    identificationNumber: string;
    securityCode: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
  }) => Promise<{ id: string }>;
  getPaymentMethods: (
    data: { bin: string }
  ) => Promise<{ results: { id: string; issuer?: { id?: string | number } }[] }>;
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, opts?: { locale?: string }) => MercadoPagoInstance;
  }
}

let loadPromise: Promise<void> | null = null;

function loadMercadoPagoScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Solo funciona en el navegador"));
  if (window.MercadoPago) return Promise.resolve();
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

async function getClient(publicKey: string): Promise<MercadoPagoInstance> {
  await loadMercadoPagoScript();
  if (!window.MercadoPago) throw new Error("No se pudo cargar el sistema de pago con tarjeta");
  return new window.MercadoPago(publicKey, { locale: "es-AR" });
}

// Detecta la marca de la tarjeta (payment_method_id, ej. "visa") a partir de
// los primeros 6 dígitos — Mercado Pago no exige elegirla a mano como
// Payway, la resuelve por BIN.
export async function detectCardBrand(
  publicKey: string,
  bin: string
): Promise<{ paymentMethodId: string; issuerId?: string } | null> {
  const mp = await getClient(publicKey);
  const { results } = await mp.getPaymentMethods({ bin });
  const match = results?.[0];
  if (!match) return null;
  return { paymentMethodId: match.id, issuerId: match.issuer?.id ? String(match.issuer.id) : undefined };
}

export async function tokenizeMercadoPagoCard(
  publicKey: string,
  data: {
    cardNumber: string;
    cardholderName: string;
    identificationNumber: string;
    securityCode: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
  }
): Promise<{ token: string }> {
  const mp = await getClient(publicKey);
  try {
    const result = await mp.createCardToken({
      ...data,
      cardNumber: data.cardNumber.replace(/\s/g, ""),
      identificationType: "DNI",
    });
    return { token: result.id };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : "No se pudo validar la tarjeta");
  }
}
