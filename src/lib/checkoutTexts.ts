import { getStoreSettingsRow } from "@/lib/settings";

// Mensajes del checkout editables desde /admin/configuracion → "Checkout y mensajes".
// Vacío = se usa el texto por defecto de acá.
export const DEFAULT_CHECKOUT_TEXTS = {
  notice: "",
  successTitle: "¡Pedido registrado!",
  success: "Recibimos tu pedido y te vamos a contactar a la brevedad para coordinar el pago y la entrega.",
  successByMethod: {
    transferencia: "Recibimos tu comprobante. Verificamos el pago y coordinamos la entrega.",
    contra_entrega: "Vas a abonar al recibir el pedido. Te contactamos para coordinar la entrega.",
    mercadopago: "Tu pago fue aprobado. Ya estamos preparando tu pedido.",
    payway: "Tu pago fue aprobado. Ya estamos preparando tu pedido.",
    sin_pago: "Recibimos tu pedido. Nos pondremos en contacto para coordinar el pago y la entrega.",
  } as Record<string, string>,
};

export async function getCheckoutTexts() {
  const s = await getStoreSettingsRow();
  const d = DEFAULT_CHECKOUT_TEXTS;
  return {
    notice: s.checkoutNotice?.trim() || d.notice,
    successTitle: s.successTitle?.trim() || d.successTitle,
    success: s.successMessage?.trim() || d.success,
    successByMethod: {
      transferencia: s.successMessageTransfer?.trim() || d.successByMethod.transferencia,
      contra_entrega: s.successMessageCash?.trim() || d.successByMethod.contra_entrega,
      mercadopago: s.successMessageMercadopago?.trim() || d.successByMethod.mercadopago,
      payway: s.successMessagePayway?.trim() || d.successByMethod.payway,
      sin_pago: s.successMessageNoPayment?.trim() || d.successByMethod.sin_pago,
    } as Record<string, string>,
  };
}
