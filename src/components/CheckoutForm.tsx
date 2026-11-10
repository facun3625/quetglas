"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCart } from "@/lib/cart";
import { useMoney } from "@/lib/currency";
import { COUPON_STORAGE_KEY } from "@/components/CouponCapture";
import { getCartSessionId } from "@/lib/cartSession";
import { tokenizeCard } from "@/lib/decidirScript";
import { PAYWAY_CARD_BRANDS, PROVINCIAS_AR } from "@/lib/payway";
import { detectCardBrand, tokenizeMercadoPagoCard } from "@/lib/mercadoPagoScript";
import { ShippingPicker, type ShippingSelection } from "@/components/ShippingPicker";
import { isLikelyPhone } from "@/lib/whatsapp";

type PaymentMethod = "mercadopago" | "transferencia" | "contra_entrega" | "payway" | "sin_pago";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia bancaria",
  contra_entrega: "Contra entrega",
  payway: "Tarjeta de crédito/débito",
  sin_pago: "Coordinar el pago con la tienda",
};

type AvailableMethod = {
  method: PaymentMethod;
  discountPct: number;
  bankCbu?: string | null;
  bankAlias?: string | null;
  bankHolderName?: string | null;
  paywayPublicKey?: string | null;
  paywaySandbox?: boolean;
  mpPublicKey?: string | null;
  noPaymentInstructions?: string | null;
};

export function CheckoutForm() {
  const { formatMoney } = useMoney();
  const router = useRouter();
  const { data: session } = useSession();
  const { items, total, clear, recoveryPhone, saveRecoveryPhone } = useCart();

  const [methods, setMethods] = useState<AvailableMethod[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [shippingSel, setShippingSel] = useState<ShippingSelection | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState<string | null>(null);
  const phone = phoneInput ?? recoveryPhone;
  const [comprobante, setComprobante] = useState<File | null>(null);
  const checkoutIdRef = useRef<string | null>(null);
  const [requiresReview, setRequiresReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortages, setShortages] = useState<{ name: string; available: number; requested: number }[] | null>(null);

  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number; freeShipping: boolean } | null>(null);
  const [methodDiscount, setMethodDiscount] = useState(0);

  // Payway: la tarjeta se tokeniza del lado del cliente (decidir.js), nunca
  // viaja el número real a nuestro server. formRef apunta al <form> entero:
  // decidir.js busca ahí adentro los inputs marcados con data-decidir.
  const formRef = useRef<HTMLFormElement>(null);
  const [paywayCardBrand, setPaywayCardBrand] = useState<number>(PAYWAY_CARD_BRANDS[0].id);
  // Payway pide datos de facturación completos para el control antifraude
  // (más allá de la dirección de envío, que puede no existir si es retiro
  // en el local).
  const [paywayStreet, setPaywayStreet] = useState("");
  const [paywayCity, setPaywayCity] = useState("");
  const [paywayState, setPaywayState] = useState("");
  const [paywayPostalCode, setPaywayPostalCode] = useState("");

  // Mercado Pago: a diferencia de decidir.js, mp.createCardToken recibe un
  // objeto JS común — no necesita un <form> con atributos data-*, así que
  // estos campos son estado controlado normal.
  const [mpCardNumber, setMpCardNumber] = useState("");
  const [mpCardholderName, setMpCardholderName] = useState("");
  const [mpExpMonth, setMpExpMonth] = useState("");
  const [mpExpYear, setMpExpYear] = useState("");
  const [mpCvv, setMpCvv] = useState("");
  const [mpDni, setMpDni] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/checkout-texts")
      .then((res) => res.json())
      .then((data: { notice?: string }) => setNotice(data.notice ?? ""))
      .catch(() => undefined);
    fetch("/api/payment-methods", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: AvailableMethod[]) => {
        setMethods(data);
        if (data.length > 0) setSelectedMethod(data[0].method);
      })
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name ?? "");
      setEmail(session.user.email ?? "");
    }
  }, [session]);

  // El sync de lib/cart.tsx solo manda datos de la sesión — un visitante
  // anónimo que ya tipeó nombre/email/teléfono acá pero todavía no confirmó
  // el pedido quedaba con esos datos perdidos (el carrito abandonado se
  // guardaba como "Anónimo"). Este segundo sync manda lo que se va
  // completando en el checkout, para el mismo sessionId.
  useEffect(() => {
    // No persistimos un telefono a medio escribir. Apenas tiene formato
    // suficiente para poder abrir WhatsApp, queda asociado al carrito aunque
    // la persona no avance al resto del checkout.
    const recoveryPhone = isLikelyPhone(phone) ? phone.trim() : undefined;
    if (!name.trim() && !email.trim() && !recoveryPhone) return;
    const handle = setTimeout(() => {
      const sessionId = getCartSessionId();
      if (!sessionId || items.length === 0) return;
      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: session?.user?.id,
          email: email.trim() || undefined,
          name: name.trim() || undefined,
          phone: recoveryPhone,
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, price: i.price, quantity: i.quantity })),
          total,
        }),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, phone]);

  // Un cupón ya aplicado puede dejar de ser válido si se cambia de medio de
  // pago (algunos cupones aplican solo a un medio específico).
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, [selectedMethod]);

  // El descuento por medio de pago puede variar por categoría (ver
  // lib/paymentMethodDiscount.ts), así que no se puede calcular solo con el
  // discountPct plano que ya trae /api/payment-methods — hace falta
  // resolverlo en el server con la composición real del carrito.
  const itemsKey = items.map((i) => `${i.productId}:${i.variantId ?? ""}:${i.quantity}`).join(",");
  useEffect(() => {
    if (!selectedMethod || items.length === 0) {
      setMethodDiscount(0);
      return;
    }
    let cancelled = false;
    fetch("/api/payment-methods/discount-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: selectedMethod,
        items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity, price: i.price })),
      }),
    })
      .then((res) => res.json())
      .then((data: { discountAmount?: number }) => {
        if (!cancelled) setMethodDiscount(data.discountAmount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setMethodDiscount(0);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod, itemsKey]);

  const selectedConfig = methods?.find((m) => m.method === selectedMethod);
  const zipDiscount = shippingSel?.zipDiscount ?? 0;
  const shippingCost = shippingSel?.cost ?? 0;
  // Mismo orden que el servidor: los descuentos de producto no pasan del subtotal y el envío se suma aparte
  const productDiscounts = Math.min(total, (appliedCoupon?.discountAmount ?? 0) + zipDiscount);
  const finalTotal = Math.max(0, total - methodDiscount - productDiscounts) + shippingCost;

  // Cupón que llegó por un enlace o QR (?cupon=CODIGO): se completa y se aplica solo una vez
  const qrCouponTried = useRef(false);
  useEffect(() => {
    if (qrCouponTried.current || !selectedMethod || appliedCoupon) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(COUPON_STORAGE_KEY);
    } catch {
      /* sin almacenamiento */
    }
    if (!saved) return;
    qrCouponTried.current = true;
    setCouponCode(saved);
    void handleApplyCoupon(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod]);

  async function handleApplyCoupon(codeOverride?: string) {
    const code = (codeOverride ?? couponCode).trim();
    if (!code || !selectedMethod) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal: total,
          paymentMethod: selectedMethod,
          email: email.trim() || session?.user?.email || undefined,
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setCouponError(data.error ?? "No se pudo aplicar el cupón.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({ code: code.toUpperCase(), discountAmount: data.discountAmount, freeShipping: Boolean(data.freeShipping) });
    } catch {
      setCouponError("No se pudo conectar con el servidor.");
    } finally {
      setCouponLoading(false);
    }
  }

  function handleOrderResponse(res: Response, data: { orderId?: string; requiresReview?: boolean; resetAttempt?: boolean; error?: string; shortages?: typeof shortages }) {
    if (!res.ok) {
      if (data.requiresReview) {
        setRequiresReview(true);
      } else if (res.status === 402 || data.resetAttempt) {
        checkoutIdRef.current = null;
        try { sessionStorage.removeItem("moda-checkout-id"); } catch {}
      }
      if (res.status === 409 && data.shortages) {
        setShortages(data.shortages);
        setError(data.error ?? "Algunos productos no tienen stock suficiente.");
      } else {
        setError(data.error ?? "No se pudo crear el pedido.");
      }
      setLoading(false);
      return;
    }
    checkoutIdRef.current = null;
    try { sessionStorage.removeItem("moda-checkout-id"); } catch {}
    clear();
    router.push(`/carrito/gracias?id=${data.orderId}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMethod || loading || requiresReview) return;
    if (!checkoutIdRef.current) {
      try { checkoutIdRef.current = sessionStorage.getItem("moda-checkout-id"); } catch {}
      checkoutIdRef.current ??= crypto.randomUUID();
      try { sessionStorage.setItem("moda-checkout-id", checkoutIdRef.current); } catch {}
    }
    setLoading(true);
    setError(null);
    setShortages(null);

    const itemsPayload = items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
    const [firstName, ...restName] = name.trim().split(/\s+/);
    const customer = { name, email, phone: phone || undefined, firstName, lastName: restName.join(" ") || undefined };
    if (!shippingSel?.ready || !shippingSel.choice) {
      setError("Completá el envío: elegí una opción y cargá la dirección.");
      setLoading(false);
      return;
    }
    const shipping = shippingSel.choice;
    if (shippingSel.saveAddress && shipping.address) {
      fetch("/api/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: shipping.address, phone }) }).catch(() => undefined);
    }

    // Payway tiene su propio flujo: primero tokeniza la tarjeta en el
    // navegador (decidir.js), recién con ese token se manda al server — el
    // cobro es al toque, así que ya viaja como "pagado".
    if (selectedMethod === "payway") {
      if (!selectedConfig?.paywayPublicKey || !formRef.current) {
        setError("El pago con tarjeta no está disponible en este momento.");
        setLoading(false);
        return;
      }
      const cardNumberInput = formRef.current.querySelector<HTMLInputElement>('[data-decidir="card_number"]');
      const bin = (cardNumberInput?.value ?? "").replace(/\D/g, "").slice(0, 6);
      const [firstName, ...rest] = name.trim().split(/\s+/);

      try {
        const tokenResult = await tokenizeCard(formRef.current, {
          publicKey: selectedConfig.paywayPublicKey,
          sandbox: selectedConfig.paywaySandbox ?? true,
        });

        const res = await fetch("/api/orders/payway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkoutId: checkoutIdRef.current,
            items: itemsPayload,
            customer,
            shipping,
            couponCode: appliedCoupon?.code,
            paywayToken: tokenResult.token,
            paywayBin: bin,
            paywayPaymentMethodId: paywayCardBrand,
            paywayBillTo: {
              firstName: firstName || name,
              lastName: rest.join(" ") || firstName || name,
              phoneNumber: phone,
              street1: paywayStreet,
              city: paywayCity,
              state: paywayState,
              postalCode: paywayPostalCode,
            },
          }),
        });
        const data = await res.json();
        handleOrderResponse(res, data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo procesar el pago con tarjeta.");
        setLoading(false);
      }
      return;
    }

    // Mercado Pago: mismo espíritu que Payway (tokeniza en el navegador,
    // cobra al toque), pero la SDK detecta la marca de la tarjeta sola a
    // partir del BIN en vez de que el cliente la elija a mano.
    if (selectedMethod === "mercadopago") {
      if (!selectedConfig?.mpPublicKey) {
        setError("El pago con tarjeta no está disponible en este momento.");
        setLoading(false);
        return;
      }
      const bin = mpCardNumber.replace(/\D/g, "").slice(0, 6);

      try {
        const brand = await detectCardBrand(selectedConfig.mpPublicKey, bin);
        if (!brand) {
          setError("No se pudo reconocer la tarjeta. Revisá el número.");
          setLoading(false);
          return;
        }

        const tokenResult = await tokenizeMercadoPagoCard(selectedConfig.mpPublicKey, {
          cardNumber: mpCardNumber,
          cardholderName: mpCardholderName,
          identificationNumber: mpDni,
          securityCode: mpCvv,
          cardExpirationMonth: mpExpMonth,
          cardExpirationYear: mpExpYear,
        });

        const res = await fetch("/api/orders/mercadopago", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkoutId: checkoutIdRef.current,
            items: itemsPayload,
            customer,
            shipping,
            couponCode: appliedCoupon?.code,
            mpToken: tokenResult.token,
            mpPaymentMethodId: brand.paymentMethodId,
            mpIssuerId: brand.issuerId,
            mpInstallments: 1,
            mpIdentification: { type: "DNI", number: mpDni },
          }),
        });
        const data = await res.json();
        handleOrderResponse(res, data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo procesar el pago con tarjeta.");
        setLoading(false);
      }
      return;
    }

    const form = new FormData();
    form.set("checkoutId", checkoutIdRef.current!);
    form.set("items", JSON.stringify(itemsPayload));
    form.set("customer", JSON.stringify(customer));
    form.set("paymentMethod", selectedMethod);
    form.set("shipping", JSON.stringify(shipping));
    if (appliedCoupon) form.set("couponCode", appliedCoupon.code);
    if (comprobante) form.set("comprobante", comprobante);

    try {
      const res = await fetch("/api/orders", { method: "POST", body: form });
      const data = await res.json();
      handleOrderResponse(res, data);
    } catch {
      setError("No se pudo conectar con el servidor. Probá de nuevo.");
      setLoading(false);
    }
  }

  if (methods === null) {
    return <p className="mt-6 text-sm text-brand-muted">Cargando métodos de pago...</p>;
  }

  if (methods.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        No hay métodos de pago disponibles en este momento. Escribinos por WhatsApp para coordinar tu pedido.
      </p>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-6 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-black/10 bg-white p-3 sm:p-5">
      <h2 className="font-semibold text-brand-ink">Finalizar compra</h2>
      {notice && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-ink">{notice}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-brand-muted">Nombre</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-brand-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
          />
        </div>
        <div>
          {recoveryPhone && phoneInput === null ? (
            <div className="rounded-lg border border-black/10 bg-brand-soft/50 px-3.5 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-brand-muted">WhatsApp guardado</p>
                  <p className="truncate text-sm text-brand-ink">{recoveryPhone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPhoneInput(recoveryPhone)}
                  className="shrink-0 cursor-pointer text-xs font-semibold text-brand-pink-dark hover:underline"
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <>
              <label className="mb-1 block text-xs font-semibold text-brand-muted">Teléfono</label>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhoneInput(e.target.value)}
                onBlur={() => {
                  if (phoneInput && isLikelyPhone(phoneInput)) saveRecoveryPhone(phoneInput);
                }}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
              />
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-brand-muted">Medio de pago</p>
        <div className="flex flex-col gap-3">
          {methods.map((m) => {
            const selected = selectedMethod === m.method;
            const bankDetails = [
              m.bankHolderName && { label: "Titular", value: m.bankHolderName },
              m.bankAlias && { label: "Alias", value: m.bankAlias },
              m.bankCbu && { label: "CBU", value: m.bankCbu },
            ].filter(Boolean) as { label: string; value: string }[];

            return (
              <div
                key={m.method}
                className={`rounded-xl border px-4 py-3.5 text-sm transition-colors ${
                  selected ? "border-brand-pink bg-brand-pink/5" : "border-black/10 hover:border-black/20"
                }`}
              >
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selected}
                      onChange={() => setSelectedMethod(m.method)}
                      className="accent-brand-pink"
                    />
                    {METHOD_LABELS[m.method]}
                  </span>
                  {m.discountPct > 0 && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {m.discountPct}% off
                    </span>
                  )}
                </label>

                {selected && m.method === "sin_pago" && (
                  <p className="mt-3 border-t border-brand-pink/20 pt-3 text-xs text-brand-muted">
                    {m.noPaymentInstructions ||
                      "Registramos tu pedido y nos ponemos en contacto con vos para coordinar el pago y la entrega."}
                  </p>
                )}

                {selected && m.method === "transferencia" && (
                  <div className="mt-4 flex flex-col gap-4 border-t border-brand-pink/20 pt-4">
                    {bankDetails.length > 0 && (
                      <div className="rounded-lg bg-white p-3.5">
                        <p className="mb-2 text-xs font-semibold text-brand-muted">Datos para transferir</p>
                        <dl className="flex flex-col gap-1.5">
                          {bankDetails.map((d) => (
                            <div key={d.label} className="flex flex-col gap-0.5 min-[380px]:flex-row min-[380px]:items-baseline min-[380px]:justify-between min-[380px]:gap-3">
                              <dt className="text-xs text-brand-muted">{d.label}</dt>
                              <dd className="break-all font-mono text-sm font-medium text-brand-ink">{d.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Comprobante de la transferencia <span className="text-brand-pink-dark">(obligatorio)</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        required
                        onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                        className="block w-full cursor-pointer text-sm text-brand-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand-pink file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-pink-dark"
                      />
                      <p className="mt-1.5 text-xs text-brand-muted">
                        Para confirmar el pedido tenés que adjuntar el comprobante. Si todavía no transferiste,
                        hacelo con los datos de arriba y después subí la captura o el PDF.
                      </p>
                    </div>
                  </div>
                )}

                {selected && m.method === "payway" && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-brand-pink/20 pt-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Tipo de tarjeta</label>
                      <select
                        value={paywayCardBrand}
                        onChange={(e) => setPaywayCardBrand(Number(e.target.value))}
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      >
                        {PAYWAY_CARD_BRANDS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Número de tarjeta
                      </label>
                      <input
                        required
                        data-decidir="card_number"
                        inputMode="numeric"
                        maxLength={19}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Nombre del titular (como figura en la tarjeta)
                      </label>
                      <input
                        required
                        data-decidir="card_holder_name"
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Mes venc.</label>
                        <input
                          required
                          data-decidir="card_expiration_month"
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="MM"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Año venc.</label>
                        <input
                          required
                          data-decidir="card_expiration_year"
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="AA"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">CVV</label>
                        <input
                          required
                          data-decidir="security_code"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="•••"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-brand-muted">Datos de facturación</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Dirección</label>
                      <input
                        required
                        value={paywayStreet}
                        onChange={(e) => setPaywayStreet(e.target.value)}
                        placeholder="Calle y número"
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Ciudad</label>
                        <input
                          required
                          value={paywayCity}
                          onChange={(e) => setPaywayCity(e.target.value)}
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Provincia</label>
                        <select
                          required
                          value={paywayState}
                          onChange={(e) => setPaywayState(e.target.value)}
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        >
                          <option value="" disabled>
                            Elegir...
                          </option>
                          {PROVINCIAS_AR.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">C.P.</label>
                        <input
                          required
                          value={paywayPostalCode}
                          onChange={(e) => setPaywayPostalCode(e.target.value)}
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-brand-muted">
                      El pago se procesa al confirmar el pedido. Tu tarjeta se tokeniza en el navegador — nunca
                      viaja a nuestros servidores.
                    </p>
                  </div>
                )}

                {selected && m.method === "mercadopago" && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-brand-pink/20 pt-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Número de tarjeta
                      </label>
                      <input
                        required
                        value={mpCardNumber}
                        onChange={(e) => setMpCardNumber(e.target.value)}
                        inputMode="numeric"
                        maxLength={19}
                        placeholder="•••• •••• •••• ••••"
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-brand-muted">
                        Nombre del titular (como figura en la tarjeta)
                      </label>
                      <input
                        required
                        value={mpCardholderName}
                        onChange={(e) => setMpCardholderName(e.target.value)}
                        className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Mes venc.</label>
                        <input
                          required
                          value={mpExpMonth}
                          onChange={(e) => setMpExpMonth(e.target.value)}
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="MM"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">Año venc.</label>
                        <input
                          required
                          value={mpExpYear}
                          onChange={(e) => setMpExpYear(e.target.value)}
                          inputMode="numeric"
                          maxLength={2}
                          placeholder="AA"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">CVV</label>
                        <input
                          required
                          value={mpCvv}
                          onChange={(e) => setMpCvv(e.target.value)}
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="•••"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-brand-muted">DNI</label>
                        <input
                          required
                          value={mpDni}
                          onChange={(e) => setMpDni(e.target.value.replace(/\D/g, ""))}
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="12345678"
                          className="w-full rounded-lg border border-black/10 px-3.5 py-2 text-sm focus:border-brand-pink focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-brand-muted">
                      El pago se procesa al confirmar el pedido. Tu tarjeta se tokeniza en el navegador — nunca
                      viaja a nuestros servidores. Solo tarjeta, no incluye pago en efectivo.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ShippingPicker
        items={items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity }))}
        paymentMethod={selectedMethod}
        couponCode={appliedCoupon?.code}
        email={email.trim() || undefined}
        isLoggedIn={Boolean(session?.user)}
        onChange={setShippingSel}
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-brand-muted">Cupón de descuento (opcional)</p>
        {appliedCoupon ? (
          <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 px-3.5 py-2.5 text-sm">
            <span className="font-medium text-green-800">
              &ldquo;{appliedCoupon.code}&rdquo; aplicado — -{formatMoney(appliedCoupon.discountAmount)}
            </span>
            <button
              type="button"
              onClick={() => {
                setAppliedCoupon(null);
                setCouponCode("");
              }}
              className="cursor-pointer text-xs font-semibold text-green-800 hover:underline"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Código de cupón"
              className="flex-1 rounded-lg border border-black/10 px-3.5 py-2 text-sm uppercase focus:border-brand-pink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleApplyCoupon()}
              disabled={couponLoading || !couponCode.trim()}
              className="cursor-pointer rounded-lg bg-brand-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {couponLoading ? "..." : "Aplicar"}
            </button>
          </div>
        )}
        {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {shortages && (
            <ul className="mt-1.5 list-disc pl-4">
              {shortages.map((s) => (
                <li key={s.name}>
                  {s.name}: quedan {s.available}, pediste {s.requested}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </div>

      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 lg:sticky lg:top-24 lg:mt-0">
        <h2 className="font-semibold text-brand-ink">Resumen</h2>

        <div className="flex flex-col gap-1">
          {methodDiscount > 0 && selectedMethod && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <p>Descuento ({METHOD_LABELS[selectedMethod]})</p>
              <p>-{formatMoney(methodDiscount)}</p>
            </div>
          )}
          {appliedCoupon && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <p>Cupón ({appliedCoupon.code})</p>
              <p>-{formatMoney(appliedCoupon.discountAmount)}</p>
            </div>
          )}
          {zipDiscount > 0 && (
            <div className="flex items-center justify-between text-sm text-green-700">
              <p>Descuento por zona</p>
              <p>-{formatMoney(zipDiscount)}</p>
            </div>
          )}
          {shippingSel?.choice && (shippingSel.baseCost > 0 || shippingSel.choice.code === "acordar") && (
            <div className="flex items-center justify-between text-sm text-brand-muted">
              <p>Envío</p>
              <p>
                {shippingSel.isFree ? (
                  <>
                    <s className="mr-1">{formatMoney(shippingSel.baseCost)}</s>Gratis
                  </>
                ) : shippingSel.baseCost > 0 ? (
                  formatMoney(shippingSel.baseCost)
                ) : (
                  "A coordinar"
                )}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-black/10 pt-2">
            <p className="text-sm text-brand-muted">Total a pagar</p>
            <p className="text-lg font-bold text-brand-pink-dark">{formatMoney(finalTotal)}</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || requiresReview || !shippingSel?.ready}
          className="w-full cursor-pointer rounded-full bg-brand-pink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-pink-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? selectedMethod === "payway" || selectedMethod === "mercadopago"
              ? "Procesando el pago..."
              : "Confirmando..."
            : selectedMethod === "payway" || selectedMethod === "mercadopago"
              ? "Pagar y confirmar"
              : "Confirmar pedido"}
        </button>
      </div>
    </form>
  );
}
