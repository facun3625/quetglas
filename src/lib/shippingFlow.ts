import { prisma } from "@/lib/prisma";
import { getStoreSettingsRow } from "@/lib/settings";
import { getAllowedBuiltinCodes, getShippingMethodsForPayment } from "@/lib/shipping";
import { isProvince } from "@/lib/provinces";
import { ocaBranches, ocaQuote, OcaError, type OcaBranch, type OcaConfig, type OcaQuote } from "@/lib/oca/client";
import { quoteMeasures, type ShippingItem } from "@/lib/oca/package";

// Cómo se decide el envío de un pedido. Lo usan DOS lugares con las mismas reglas:
//  - getShippingOptions: lo que se le ofrece al cliente en el checkout (por código postal y carrito);
//  - resolveShipping: lo que el SERVIDOR vuelve a calcular al crear el pedido. Nunca se confía en el costo que
//    manda el navegador: se re-cotiza con OCA, se valida la sucursal y se re-aplican restricciones y envío gratis.

export type ShippingConfig = {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  acordarEnabled: boolean;
  zipRestrictionsEnabled: boolean;
  zipDiscountsEnabled: boolean;
  defaults: { weightKg: number; dimCm: number };
  ocaEnabled: boolean;
  ocaBranchDiscountPct: number;
  oca: OcaConfig;
};

type SettingsRow = Awaited<ReturnType<typeof getStoreSettingsRow>>;

export function shippingConfigFromRow(row: Partial<SettingsRow>): ShippingConfig {
  return {
    freeShippingEnabled: row.freeShippingEnabled ?? false,
    freeShippingThreshold: row.freeShippingThreshold ?? 0,
    acordarEnabled: row.acordarEnabled ?? true,
    zipRestrictionsEnabled: row.zipRestrictionsEnabled ?? true,
    zipDiscountsEnabled: row.zipDiscountsEnabled ?? true,
    defaults: { weightKg: row.shippingDefaultWeightKg ?? 1, dimCm: row.shippingDefaultDimCm ?? 20 },
    ocaEnabled: row.ocaEnabled ?? false,
    ocaBranchDiscountPct: row.ocaBranchDiscountPct ?? 30,
    oca: {
      cuit: row.ocaCuit ?? null,
      operativa: row.ocaOperativa ?? null,
      operativaSucursal: row.ocaOperativaSucursal ?? null,
      originZipCode: row.ocaOriginZipCode ?? null,
      user: row.ocaUser ?? null,
      password: row.ocaPassword ?? null,
      nroCliente: row.ocaNroCliente ?? null,
      originStreet: row.ocaOriginStreet ?? null,
      originNumber: row.ocaOriginNumber ?? null,
      originFloor: row.ocaOriginFloor ?? null,
      originCity: row.ocaOriginCity ?? null,
      originProvince: row.ocaOriginProvince ?? null,
      originContact: row.ocaOriginContact ?? null,
      originEmail: row.ocaOriginEmail ?? null,
      franjaHoraria: row.ocaFranjaHoraria ?? "1",
    },
  };
}

export async function loadShippingConfig(): Promise<ShippingConfig> {
  return shippingConfigFromRow(await getStoreSettingsRow());
}

// ---------- Reglas puras ----------

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

export function isFreeShipping(cfg: Pick<ShippingConfig, "freeShippingEnabled" | "freeShippingThreshold">, subtotal: number, couponFreeShipping = false): boolean {
  return couponFreeShipping || (cfg.freeShippingEnabled && cfg.freeShippingThreshold > 0 && subtotal >= cfg.freeShippingThreshold);
}

// Descuento por código postal sobre el subtotal de productos (nunca más que el subtotal)
export function zipDiscountAmount(discount: { discountType: "percentage" | "fixed" | "free_shipping"; discountValue: number } | null, subtotal: number): number {
  if (!discount || discount.discountType === "free_shipping") return 0;
  const raw = discount.discountType === "percentage" ? subtotal * (discount.discountValue / 100) : discount.discountValue;
  return roundMoney(Math.min(Math.max(0, raw), subtotal));
}

// El descuento del cupón y el de la zona se suman, sin pasar del subtotal
export function stackDiscounts(subtotal: number, ...discounts: number[]): number {
  return Math.min(subtotal, discounts.reduce((a, b) => a + b, 0));
}

export const BUILTIN_CODES = ["oca_domicilio", "oca_sucursal", "acordar"] as const;
export type BuiltinCode = (typeof BUILTIN_CODES)[number];
export const isBuiltin = (code: string): code is BuiltinCode => (BUILTIN_CODES as readonly string[]).includes(code);

const OCA_ZIP = /^\d{4}$/;

// ---------- Zona (código postal) ----------

export type Restriction = { type: "block_sale" | "block_shipping"; message: string | null; address: string | null; phone: string | null };
export type ZipDiscountInfo = { discountType: "percentage" | "fixed" | "free_shipping"; discountValue: number; label: string | null };

export async function zoneInfo(zip: string, cfg: ShippingConfig): Promise<{ restriction: Restriction | null; discount: ZipDiscountInfo | null }> {
  if (!zip) return { restriction: null, discount: null };
  const [restrictions, discount] = await Promise.all([
    cfg.zipRestrictionsEnabled ? prisma.zipCodeRestriction.findMany({ where: { zipCode: zip } }) : Promise.resolve([]),
    cfg.zipDiscountsEnabled ? prisma.zipCodeDiscount.findFirst({ where: { zipCode: zip, enabled: true } }) : Promise.resolve(null),
  ]);
  // Si el mismo código postal tiene las dos restricciones, "no se vende" manda
  const restriction = restrictions.find((r) => r.type === "block_sale") ?? restrictions.find((r) => r.type === "block_shipping") ?? null;
  return {
    restriction: restriction ? { type: restriction.type, message: restriction.message, address: restriction.address, phone: restriction.phone } : null,
    discount: discount ? { discountType: discount.discountType, discountValue: discount.discountValue, label: discount.label } : null,
  };
}

// ---------- OCA con caché corta (la misma cotización se pide al ofrecer y al crear el pedido) ----------

export type OcaDeps = {
  quote: (cfg: OcaConfig, args: { destinationZip: string; weightKg: number; volumeM3: number }) => Promise<OcaQuote>;
  branches: (zip: string) => Promise<OcaBranch[]>;
};
const defaultOca: OcaDeps = { quote: (cfg, args) => ocaQuote(cfg, args), branches: (zip) => ocaBranches(zip) };

const CACHE_MS = 90_000;
const cache = ((globalThis as unknown as { __ocaCache?: Map<string, { at: number; value: unknown }> }).__ocaCache ??= new Map());
async function cached<T>(key: string, fn: () => Promise<T>, enabled: boolean): Promise<T> {
  if (!enabled) return fn();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) for (const k of cache.keys()) { cache.delete(k); if (cache.size <= 250) break; }
  return value;
}

async function ocaFor(cfg: ShippingConfig, zip: string, items: ShippingItem[], deps: OcaDeps) {
  const m = quoteMeasures(items, cfg.defaults);
  const useCache = deps === defaultOca;
  const [quote, branches] = await Promise.all([
    cached(`q:${cfg.oca.cuit}:${cfg.oca.operativa}:${cfg.oca.originZipCode}:${zip}:${m.weightKg}:${m.volumeM3}`, () => deps.quote(cfg.oca, { destinationZip: zip, ...m }), useCache),
    cached(`b:${zip}`, () => deps.branches(zip), useCache),
  ]);
  const branchFactor = 1 - cfg.ocaBranchDiscountPct / 100;
  return {
    quote,
    branches,
    domicilio: { price: roundMoney(quote.price), base: roundMoney(quote.priceBeforeTax), iva: roundMoney(quote.iva) },
    sucursal: { price: roundMoney(quote.price * branchFactor), base: roundMoney(quote.priceBeforeTax * branchFactor), iva: roundMoney(quote.iva * branchFactor) },
  };
}

// ---------- Opciones para el checkout ----------

export type ShippingOption = {
  code: string;
  kind: "manual" | "oca" | "acordar";
  label: string;
  description: string;
  // null = a coordinar
  price: number | null;
  priceBeforeTax?: number;
  iva?: number;
  deliveryDays?: number;
  requiresAddress: boolean;
  branches?: OcaBranch[];
};

export type ShippingOptionsResult = {
  zipCode: string;
  restriction: Restriction | null;
  zipDiscount: (ZipDiscountInfo & { amount: number }) | null;
  freeShipping: { active: boolean; threshold: number; viaThreshold: boolean };
  ocaEnabled: boolean;
  ocaError: string | null;
  options: ShippingOption[];
};

export async function getShippingOptions(args: {
  zipCode: string;
  items: ShippingItem[];
  subtotal: number;
  paymentMethodConfigId?: string;
  couponFreeShipping?: boolean;
  deps?: OcaDeps;
  cfg?: ShippingConfig;
}): Promise<ShippingOptionsResult> {
  const cfg = args.cfg ?? (await loadShippingConfig());
  const deps = args.deps ?? defaultOca;
  const zip = args.zipCode.trim();
  const { restriction, discount } = await zoneInfo(zip, cfg);

  const options: ShippingOption[] = [];
  const viaThreshold = isFreeShipping(cfg, args.subtotal);
  const free = viaThreshold || Boolean(args.couponFreeShipping);

  // Una zona donde no se vende no recibe ninguna opción (el checkout muestra el aviso y no deja avanzar)
  if (restriction?.type === "block_sale") {
    return { zipCode: zip, restriction, zipDiscount: null, freeShipping: { active: free, threshold: cfg.freeShippingEnabled ? cfg.freeShippingThreshold : 0, viaThreshold }, ocaEnabled: cfg.ocaEnabled, ocaError: null, options: [] };
  }

  // Métodos propios (retiro en el local, etc.), respetando las restricciones por medio de pago
  if (args.paymentMethodConfigId) {
    for (const m of await getShippingMethodsForPayment(args.paymentMethodConfigId)) {
      options.push({ code: m.id, kind: "manual", label: m.name, description: m.description ?? "", price: m.cost, requiresAddress: m.requiresAddress });
    }
  }

  // Modalidades de la tienda que este medio de pago admite (null = todas)
  const allowed = args.paymentMethodConfigId ? await getAllowedBuiltinCodes(args.paymentMethodConfigId) : null;
  const permits = (code: string) => allowed === null || allowed.includes(code);

  let ocaError: string | null = null;
  const blocked = restriction?.type === "block_shipping";
  if (cfg.ocaEnabled && OCA_ZIP.test(zip) && !blocked && (permits("oca_domicilio") || permits("oca_sucursal"))) {
    try {
      const oca = await ocaFor(cfg, zip, args.items, deps);
      if (permits("oca_domicilio")) options.push({
        code: "oca_domicilio", kind: "oca", label: "OCA a domicilio", description: `Llega en aprox. ${oca.quote.deliveryDays} días hábiles`,
        price: oca.domicilio.price, priceBeforeTax: oca.domicilio.base, iva: oca.domicilio.iva, deliveryDays: oca.quote.deliveryDays, requiresAddress: true,
      });
      if (oca.branches.length > 0 && permits("oca_sucursal")) {
        options.push({
          code: "oca_sucursal", kind: "oca", label: "Retiro en sucursal OCA", description: "Más económico y rápido",
          price: oca.sucursal.price, priceBeforeTax: oca.sucursal.base, iva: oca.sucursal.iva, deliveryDays: oca.quote.deliveryDays, requiresAddress: true, branches: oca.branches,
        });
      }
    } catch (err) {
      ocaError = err instanceof OcaError ? err.message : "No pudimos obtener tarifas de OCA";
    }
  }
  if (cfg.acordarEnabled && !restriction && permits("acordar")) {
    options.push({ code: "acordar", kind: "acordar", label: "Envío a acordar / otros medios", description: "Nos contactaremos con vos para coordinar el envío", price: null, requiresAddress: true });
  }

  return {
    zipCode: zip,
    restriction,
    zipDiscount: discount ? { ...discount, amount: zipDiscountAmount(discount, args.subtotal) } : null,
    freeShipping: { active: free, threshold: cfg.freeShippingEnabled ? cfg.freeShippingThreshold : 0, viaThreshold },
    ocaEnabled: cfg.ocaEnabled,
    ocaError,
    options,
  };
}

// ---------- Resolución final (servidor, al crear el pedido) ----------

export type ShippingAddress = { street: string; number: string; apartment?: string; city: string; province: string; zipCode: string };
export type ShippingChoice = { code: string; branchId?: string; address?: Partial<ShippingAddress> };

export type ShippingData = ShippingAddress & { branchId?: string; branchName?: string; isBranch?: boolean };

export type ResolvedShipping =
  | {
      ok: true;
      code: string;
      name: string;
      // Lo que se cobra (0 si hay envío gratis) y lo que habría costado
      cost: number;
      baseCost: number;
      isFree: boolean;
      requiresAddress: boolean;
      manualMethodId: string | null;
      addressText: string | null;
      data: ShippingData | null;
      zipDiscount: number;
    }
  | { ok: false; error: string; status: number };

const fail = (error: string, status = 400): ResolvedShipping => ({ ok: false, error, status });

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizeAddress(input: Partial<ShippingAddress> | undefined): { ok: true; address: ShippingAddress } | { ok: false; error: string } {
  const a = {
    street: clean(input?.street, 120),
    number: clean(input?.number, 20),
    apartment: clean(input?.apartment, 40),
    city: clean(input?.city, 80),
    province: clean(input?.province, 40),
    zipCode: clean(input?.zipCode, 10),
  };
  if (!a.street || !a.number || !a.city || !a.province || !a.zipCode) return { ok: false, error: "Completá la dirección de envío (calle, número, ciudad, provincia y código postal)" };
  if (!isProvince(a.province)) return { ok: false, error: "La provincia no es válida" };
  if (!/^[A-Za-z0-9 -]{3,10}$/.test(a.zipCode)) return { ok: false, error: "El código postal no es válido" };
  return { ok: true, address: a };
}

export function addressText(a: ShippingAddress, branchName?: string): string {
  const base = `${a.street} ${a.number}${a.apartment ? `, ${a.apartment}` : ""}, ${a.city}, ${a.province} (CP ${a.zipCode})`;
  return branchName ? `${base} — Retira en sucursal OCA ${branchName}` : base;
}

export async function resolveShipping(args: {
  choice: ShippingChoice;
  items: ShippingItem[];
  subtotal: number;
  paymentMethodConfigId: string;
  couponFreeShipping?: boolean;
  deps?: OcaDeps;
  cfg?: ShippingConfig;
}): Promise<ResolvedShipping> {
  const cfg = args.cfg ?? (await loadShippingConfig());
  const deps = args.deps ?? defaultOca;
  const code = clean(args.choice?.code, 64);
  if (!code) return fail("Elegí un método de envío");

  // Método propio (retiro, envío con costo fijo...)
  if (!isBuiltin(code)) {
    const methods = await getShippingMethodsForPayment(args.paymentMethodConfigId);
    const method = methods.find((m) => m.id === code);
    if (!method) return fail("Método de envío inválido para este medio de pago");
    let address: ShippingAddress | null = null;
    let zone: Awaited<ReturnType<typeof zoneInfo>> = { restriction: null, discount: null };
    if (method.requiresAddress) {
      const checked = normalizeAddress(args.choice.address);
      if (!checked.ok) return fail(checked.error);
      address = checked.address;
      zone = await zoneInfo(address.zipCode, cfg);
      if (zone.restriction?.type === "block_sale") return fail(zone.restriction.message || "No hacemos ventas a ese código postal", 409);
    }
    const free = isFreeShipping(cfg, args.subtotal, args.couponFreeShipping);
    return {
      ok: true, code: method.id, name: method.name, cost: free ? 0 : method.cost, baseCost: method.cost, isFree: free && method.cost > 0,
      requiresAddress: method.requiresAddress, manualMethodId: method.id,
      addressText: address ? addressText(address) : null, data: address ? { ...address } : null,
      zipDiscount: zipDiscountAmount(zone.discount, args.subtotal),
    };
  }

  // Métodos dinámicos: siempre llevan dirección
  const checked = normalizeAddress(args.choice.address);
  if (!checked.ok) return fail(checked.error);
  const address = checked.address;
  const zone = await zoneInfo(address.zipCode, cfg);
  if (zone.restriction?.type === "block_sale") return fail(zone.restriction.message || "No hacemos ventas a ese código postal", 409);
  const zipDiscount = zipDiscountAmount(zone.discount, args.subtotal);
  const free = isFreeShipping(cfg, args.subtotal, args.couponFreeShipping);
  const allowed = await getAllowedBuiltinCodes(args.paymentMethodConfigId);
  if (allowed !== null && !allowed.includes(code)) return fail("Ese método de envío no está disponible con el medio de pago elegido");
  const finish = (name: string, baseCost: number, data: ShippingData): ResolvedShipping => ({
    ok: true, code, name, cost: free ? 0 : baseCost, baseCost, isFree: free && baseCost > 0, requiresAddress: true, manualMethodId: null,
    addressText: addressText(address, data.branchName), data, zipDiscount,
  });

  if (code === "acordar") {
    if (!cfg.acordarEnabled || zone.restriction) return fail("Ese método de envío no está disponible");
    return finish("Envío a acordar", 0, { ...address });
  }

  // OCA
  if (!cfg.ocaEnabled) return fail("OCA no está disponible en este momento");
  if (zone.restriction) return fail(zone.restriction.message || "OCA no llega a ese código postal. Elegí otro método de envío.");
  if (!OCA_ZIP.test(address.zipCode)) return fail("Para enviar con OCA el código postal debe tener 4 dígitos");
  let oca: Awaited<ReturnType<typeof ocaFor>>;
  try {
    oca = await ocaFor(cfg, address.zipCode, args.items, deps);
  } catch (err) {
    return fail(err instanceof OcaError ? `OCA: ${err.message}` : "No pudimos cotizar el envío con OCA. Probá de nuevo o elegí otro método.", 502);
  }

  if (code === "oca_domicilio") return finish("OCA a domicilio", oca.domicilio.price, { ...address });

  // oca_sucursal: la sucursal tiene que ser una de las que OCA informa para ese código postal
  if (oca.branches.length === 0) return fail("No hay sucursales de OCA para ese código postal");
  const wanted = clean(args.choice.branchId, 40) || (oca.branches.length === 1 ? oca.branches[0].id : "");
  const branch = oca.branches.find((b) => b.id === wanted);
  if (!branch) return fail("Elegí una sucursal de OCA");
  return finish("Retiro en sucursal OCA", oca.sucursal.price, { ...address, branchId: branch.id, branchName: branch.name, isBranch: true });
}
