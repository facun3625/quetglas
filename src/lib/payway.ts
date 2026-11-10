// Cliente de la API de Payway (gateway Decidir "de marca blanca" que usa
// Payway/Prisma en Argentina). El cobro es SÍNCRONO: se llama a /payments con
// el token que generó el cliente (decidir.js) y la respuesta ya trae
// "approved" o "rejected" al toque, sin necesidad de webhook.
//
// Probado de verdad (no solo leído en docs): tokenización real vía decidir.js
// en un navegador headless + cobro contra developers.decidir.com con
// credenciales de sandbox reales. La API pide, además del token, un bloque
// "fraud_detection" completo (bill_to + purchase_totals + retail_transaction_data
// con ship_to e items) — sin él, rechaza con "Fraud Detection Data is required".
// Con el bloque completo, la prueba real pasó el control antifraude y llegó al
// simulador del banco.
const SANDBOX_BASE_URL = "https://developers.decidir.com/api/v2";
// Confirmado contra la guía oficial de integración (coincide con el dominio
// del propio script decidir.js que se carga en el checkout).
const PRODUCTION_BASE_URL = "https://ventasonline.payway.com.ar/api/v2";

export function getPaywayBaseUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
}

// Decidir necesita el ID numérico de la marca/tipo de tarjeta (no lo infiere
// del BIN de forma confiable vía API pública), tomado de la tabla oficial de
// medios de pago. Se lo pedimos al cliente con un select en vez de
// adivinarlo por los primeros dígitos, para no enrutar mal un cobro.
//
// Estos IDs son ESPECÍFICOS de la cuenta de Cortopassi - Tienda, no la tabla genérica
// pública de Decidir (esa cambia por cuenta — la propia guía de Payway lo
// advierte). Verificados el 2026-08-19 en dos pasos, contra el sandbox real:
//   1. GET /payment-methods/all con la public key: expone el catálogo
//      completo de Decidir, donde las variantes con sufijo "Payway" (ej.
//      "104 MasterCard Payway") son las que corresponden a cuentas Payway
//      (vs. "118 MasterCard Fiserv", de otro procesador).
//   2. Confirmado con pagos de prueba reales (POST /payments) probando cada
//      ID candidato: los que aparecen abajo pasan la validación de
//      payment_method_id (avanzan a la siguiente etapa); Amex (65/6/111),
//      Tarjeta Naranja (24), Argencard (30) y Diners (8) devuelven
//      "invalid_param: payment_method_id" — no están habilitados en esta
//      cuenta, así que no se ofrecen como opción (romperían el pago para
//      cualquiera que los elija).
// Los IDs viejos (15 Mastercard, 66 MC Debit, 27 Cabal) eran los genéricos
// de la tabla pública — daban ese mismo error para esta cuenta.
export const PAYWAY_CARD_BRANDS = [
  { id: 1, label: "Visa crédito" },
  { id: 31, label: "Visa débito" },
  { id: 104, label: "Mastercard crédito" },
  { id: 105, label: "Mastercard débito" },
  { id: 63, label: "Cabal crédito" },
  { id: 108, label: "Cabal débito" },
] as const;

// `error` es SIEMPRE un mensaje genérico, seguro para mostrarle al cliente.
// `detail` tiene el motivo técnico real (para loguear en el server nada más)
// — nunca se lo mostramos al comprador: un motivo de rechazo específico
// (ej. "fondos insuficientes") le sirve a un atacante para probar tarjetas
// robadas una por una hasta encontrar cuál "sí anda".
export type PaywayPaymentResult =
  | { ok: true; id: number; status: string }
  | { ok: false; error: string; detail: string; rejected?: boolean };

const GENERIC_DECLINE_MESSAGE = "El pago fue rechazado. Probá con otra tarjeta o con otro medio de pago.";
const GENERIC_SYSTEM_ERROR_MESSAGE = "No se pudo procesar el pago. Probá de nuevo en un momento.";

// Cybersource (el motor antifraude que usa Payway) espera el código de
// provincia como UNA sola letra — ni el nombre completo ni la sigla de 2
// letras. Se lo pedimos al cliente con un select (ver CheckoutForm) para que
// llegue siempre bien, en vez de intentar adivinarlo de texto libre.
export const PROVINCIAS_AR = [
  { code: "B", name: "Buenos Aires" },
  { code: "C", name: "Ciudad Autónoma de Buenos Aires" },
  { code: "K", name: "Catamarca" },
  { code: "H", name: "Chaco" },
  { code: "U", name: "Chubut" },
  { code: "X", name: "Córdoba" },
  { code: "W", name: "Corrientes" },
  { code: "E", name: "Entre Ríos" },
  { code: "P", name: "Formosa" },
  { code: "Y", name: "Jujuy" },
  { code: "L", name: "La Pampa" },
  { code: "F", name: "La Rioja" },
  { code: "M", name: "Mendoza" },
  { code: "N", name: "Misiones" },
  { code: "Q", name: "Neuquén" },
  { code: "R", name: "Río Negro" },
  { code: "A", name: "Salta" },
  { code: "J", name: "San Juan" },
  { code: "D", name: "San Luis" },
  { code: "Z", name: "Santa Cruz" },
  { code: "S", name: "Santa Fe" },
  { code: "G", name: "Santiago del Estero" },
  { code: "V", name: "Tierra del Fuego" },
  { code: "T", name: "Tucumán" },
] as const;

// Cybersource rechaza nombres/ciudad con tildes o ñ (ej. "Martín", "Núñez").
// Se sanitiza antes de mandar — confirmado con pruebas reales.
function sinAcentos(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, (m) => (m === "ñ" ? "n" : "N"));
}

export type PaywayBillTo = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  street1: string;
  city: string;
  state: string; // código de una letra, ver PROVINCIAS_AR
  postalCode: string;
  country?: string; // default "AR"
};

export type PaywayItem = { name: string; sku: string; quantity: number; unitPrice: number };

type CreatePaywayPaymentArgs = {
  privateKey: string;
  sandbox: boolean;
  token: string; // token generado por decidir.js en el cliente
  paymentMethodId: number;
  bin: string; // primeros 6 dígitos de la tarjeta
  amount: number; // en la MISMA moneda que "total", se convierte acá a centavos
  siteTransactionId: string; // id único nuestro (referencia del pedido)
  description: string;
  customerEmail: string;
  billTo: PaywayBillTo;
  items: PaywayItem[];
};

export async function createPaywayPayment(args: CreatePaywayPaymentArgs): Promise<PaywayPaymentResult> {
  const url = `${getPaywayBaseUrl(args.sandbox)}/payments`;
  const amountCents = Math.round(args.amount * 100); // Decidir espera centavos (últimos 2 dígitos = decimales)
  const country = args.billTo.country || "AR";

  // Bloque "RetailFraudDetection" que exige la API para dejar pasar el cobro
  // (sin esto, rechaza directo con "Fraud Detection Data is required" —
  // confirmado con una prueba real). bill_to y ship_to van iguales porque no
  // manejamos facturación/envío a nombres distintos.
  const billToBlock = {
    city: sinAcentos(args.billTo.city),
    country,
    // customer_id NUNCA puede ser un email — Cybersource lo rechaza con un
    // error opaco (cybersource_error, reason.id -1) incluso con la tarjeta ya
    // autorizada por el banco. Usamos el teléfono (no es un email, siempre
    // requerido en el checkout).
    customer_id: args.billTo.phoneNumber,
    email: args.customerEmail,
    first_name: sinAcentos(args.billTo.firstName),
    last_name: sinAcentos(args.billTo.lastName),
    phone_number: args.billTo.phoneNumber,
    postal_code: args.billTo.postalCode,
    state: args.billTo.state,
    street1: sinAcentos(args.billTo.street1),
  };

  const body = {
    site_transaction_id: args.siteTransactionId.slice(0, 39),
    token: args.token,
    payment_method_id: args.paymentMethodId,
    bin: args.bin,
    amount: amountCents,
    currency: "ARS",
    installments: 1,
    description: args.description.slice(0, 89),
    payment_type: "single",
    sub_payments: [],
    customer: { email: args.customerEmail },
    fraud_detection: {
      send_to_cs: true,
      channel: "Web",
      bill_to: billToBlock,
      purchase_totals: { currency: "ARS", amount: amountCents },
      retail_transaction_data: {
        ship_to: billToBlock,
        items: args.items.map((item, i) => {
          // Cybersource exige total_amount === unit_price × quantity exacto
          // — si cada uno se redondea por separado (peso con centavos
          // fraccionarios × cantidad), pueden quedar desincronizados por un
          // centavo y el pago se rechaza. Se redondea una sola vez y se
          // deriva el total desde ahí, nunca al revés.
          const unitPriceCents = Math.round(item.unitPrice * 100);
          return {
            code: String(i + 1),
            description: item.name.slice(0, 60),
            name: item.name.slice(0, 60),
            sku: item.sku || String(i + 1),
            total_amount: unitPriceCents * item.quantity,
            quantity: item.quantity,
            unit_price: unitPriceCents,
          };
        }),
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.privateKey },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    // Ojo: Payway devuelve HTTP 402 para pagos rechazados, pero el body SÍ
    // trae el detalle completo (status/status_details/fraud_detection) —
    // confirmado con una prueba real. Si no viene ni siquiera un "status" en
    // el body, ahí sí es un error de verdad (auth, validación, etc.).
    if (typeof data?.status === "string") {
      if (data.status !== "approved") {
        const fraud = data?.fraud_detection?.status;
        const fraudDetail = fraud?.decision === "black" ? fraud?.details?.validation_errors?.[0]?.param : undefined;
        const detail =
          fraudDetail ||
          data?.status_details?.error?.reason?.description ||
          data?.status_details?.error?.type ||
          data.status;
        return { ok: false, rejected: data.status === "rejected", error: GENERIC_DECLINE_MESSAGE, detail: `Pago ${data.status}${detail ? ` (${detail})` : ""}` };
      }
      return { ok: true, id: data.id, status: data.status };
    }

    const detail = data?.error_type || data?.message || data?.[0]?.message || `Payway respondió ${res.status}`;
    return { ok: false, error: GENERIC_SYSTEM_ERROR_MESSAGE, detail: String(detail) };
  } catch (err) {
    return {
      ok: false,
      error: GENERIC_SYSTEM_ERROR_MESSAGE,
      detail: err instanceof Error ? err.message : "No se pudo conectar con Payway",
    };
  }
}

// Reembolso total — se usa como red de seguridad si el cobro se aprobó pero
// después no se pudo confirmar el pedido (ej. se quedó sin stock en el
// candado de reserva justo en ese instante).
export async function refundPaywayPayment(args: {
  privateKey: string;
  sandbox: boolean;
  paymentId: number;
}): Promise<{ ok: boolean; error?: string }> {
  const url = `${getPaywayBaseUrl(args.sandbox)}/payments/${args.paymentId}/refunds`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: args.privateKey },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.message || `Payway respondió ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo conectar con Payway" };
  }
}
