import { parseStringPromise } from "xml2js";
import {
  escapeXml,
  formatCuit,
  normalizeCity,
  normalizeProvince,
  ocaDate,
  parseApartment,
  removeAccents,
  sanitizeEmail,
} from "./format";
import { shipmentPackage, type PackageDefaults, type ShippingItem } from "./package";

// Cliente de OCA ePak. Mismos endpoints y formatos que la integración que ya funciona en Araí:
//  - Tarifar_Envio_Corporativo (GET): cotización, sin IVA (se suma el 21 % acá, una sola vez);
//  - GetCentrosImposicionConServiciosByCP (GET): sucursales de un código postal;
//  - IngresoORMultiplesRetiros (POST): registra el envío y devuelve la orden de retiro (número de seguimiento);
//  - GetPdfDeEtiquetasPorOrdenOrNumeroEnvio (GET): rótulo en PDF.
// Todo recibe un `fetchImpl` para poder probarse sin red.

const BASE = "webservice.oca.com.ar";
const IVA = 0.21;
const TIMEOUT_MS = 25_000;

export class OcaError extends Error {}

export type OcaConfig = {
  cuit: string | null;
  operativa: string | null;
  operativaSucursal: string | null;
  originZipCode: string | null;
  // Para registrar envíos
  user: string | null;
  password: string | null;
  nroCliente: string | null;
  originStreet: string | null;
  originNumber: string | null;
  originFloor: string | null;
  originCity: string | null;
  originProvince: string | null;
  originContact: string | null;
  originEmail: string | null;
  franjaHoraria: string | null;
};

type Deps = { fetchImpl?: typeof fetch };

const strip = (name: string) => name.replace(/.*:/, "");

async function get(url: string, deps: Deps) {
  const res = await (deps.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res;
}

function findDeep(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (key in record) return record[key];
  for (const k of Object.keys(record)) {
    const found = findDeep(record[k], key);
    if (found) return found;
  }
  return null;
}

// ---------- Cotización ----------

export type OcaQuote = { price: number; priceBeforeTax: number; iva: number; deliveryDays: number };

export function quoteUrl(cfg: OcaConfig, args: { destinationZip: string; weightKg: number; volumeM3: number; packages?: number; isBranch?: boolean }): string {
  const cuit = formatCuit(cfg.cuit);
  const operativa = args.isBranch ? cfg.operativaSucursal || cfg.operativa : cfg.operativa;
  if (!cuit || !operativa || !cfg.originZipCode) throw new OcaError("La configuración de OCA está incompleta (CUIT, operativa y código postal de origen).");
  const qs = new URLSearchParams({
    CUIT: cuit,
    Operativa: operativa,
    PesoTotal: String(args.weightKg),
    VolumenTotal: String(args.volumeM3),
    CodigoPostalOrigen: cfg.originZipCode,
    CodigoPostalDestino: args.destinationZip,
    CantidadPaquetes: String(args.packages ?? 1),
    ValorDeclarado: "0",
  });
  return `http://${BASE}/ePak_tracking/Oep_TrackEPak.asmx/Tarifar_Envio_Corporativo?${qs.toString()}`;
}

export async function parseQuoteXml(xml: string): Promise<OcaQuote> {
  const result = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true, tagNameProcessors: [strip] });
  const table = (findDeep(result, "Table") as Record<string, string> | Record<string, string>[] | null) ?? null;
  const row = Array.isArray(table) ? table[0] : table;
  if (!row) throw new OcaError("No se pudo obtener cotización de OCA");
  if (row.Error) throw new OcaError(String(row.Error));
  const priceBeforeTax = parseFloat(row.Total || row.Precio || "0");
  if (!Number.isFinite(priceBeforeTax) || priceBeforeTax <= 0) throw new OcaError("OCA no devolvió un precio válido para ese código postal");
  const iva = priceBeforeTax * IVA;
  return { price: priceBeforeTax + iva, priceBeforeTax, iva, deliveryDays: parseInt(row.PlazoEntrega || "0", 10) || 0 };
}

export async function ocaQuote(cfg: OcaConfig, args: Parameters<typeof quoteUrl>[1], deps: Deps = {}): Promise<OcaQuote> {
  const res = await get(quoteUrl(cfg, args), deps).catch(() => {
    throw new OcaError("No pudimos conectar con OCA");
  });
  if (!res.ok) throw new OcaError("OCA no respondió correctamente");
  return parseQuoteXml(await res.text());
}

// ---------- Sucursales ----------

export type OcaBranch = { id: string; name: string; address: string; city: string; zipCode: string };

export async function parseBranchesXml(xml: string): Promise<OcaBranch[]> {
  const result = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: true, tagNameProcessors: [strip] });
  let centers = (findDeep(result, "Table") ?? findDeep(result, "Centro")) as Record<string, string> | Record<string, string>[] | null;
  if (!centers) return [];
  if (!Array.isArray(centers)) centers = [centers];
  return centers
    .map((c) => ({
      id: String(c.IdCentroImposicion ?? c.idCentroImposicion ?? "").trim(),
      name: String(c.Sigla ?? c.Nombre ?? "").trim(),
      address: `${c.Calle ?? ""} ${c.Numero ?? ""}`.trim(),
      city: String(c.Localidad ?? "").trim(),
      zipCode: String(c.CodigoPostal ?? "").trim(),
    }))
    .filter((b) => b.id);
}

export async function ocaBranches(zipCode: string, deps: Deps = {}): Promise<OcaBranch[]> {
  const zip = encodeURIComponent(zipCode);
  let res = await get(`http://${BASE}/ePak_tracking/Oep_TrackEPak.asmx/GetCentrosImposicionConServiciosByCP?CodigoPostal=${zip}`, deps).catch(() => null);
  // Respaldo: el servicio principal a veces responde 500
  if (!res || !res.ok) res = await get(`http://${BASE}/ePak_tracking/Oep_TrackEPak.asmx/GetCentrosImposicion?ZipCode=${zip}`, deps).catch(() => null);
  if (!res || !res.ok) return [];
  return parseBranchesXml(await res.text()).catch(() => []);
}

// ---------- Registro del envío (orden de retiro) ----------

export type ShipmentOrder = {
  orderNumber: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isBranch: boolean;
  address: { street?: string; number?: string; apartment?: string; city?: string; province?: string; zipCode?: string; branchId?: string };
  items: ShippingItem[];
};

async function centroImposicionOrigen(zip: string, deps: Deps): Promise<string> {
  try {
    const res = await get(`https://${BASE}/epak_tracking/Oep_TrackEPak.asmx/GetCentrosImposicionConServiciosByCP?CodigoPostal=${encodeURIComponent(zip)}`, deps);
    const parsed = await parseStringPromise(await res.text(), { explicitArray: true, tagNameProcessors: [strip] });
    const id = parsed?.DataSet?.diffgram?.[0]?.NewDataSet?.[0]?.Table?.[0]?.IdCentroImposicion?.[0];
    return id ? String(id).trim() : "0";
  } catch {
    return "0";
  }
}

async function centroCosto(cuit: string, operativa: string, deps: Deps): Promise<string> {
  try {
    const res = await (deps.fetchImpl ?? fetch)(`https://${BASE}/oep_tracking/Oep_Track.asmx/GetCentroCostoPorOperativa`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ CUIT: cuit, Operativa: operativa }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const parsed = await parseStringPromise(await res.text(), { explicitArray: true, tagNameProcessors: [strip] });
    const row = parsed?.DataSet?.diffgram?.[0]?.NewDataSet?.[0]?.Table?.[0];
    const cc = row?.NroCentroCosto?.[0] ?? row?.CentroCosto?.[0] ?? row?.IdCentroCosto?.[0];
    return cc ? String(cc).trim() : "1";
  } catch {
    return "1";
  }
}

export function buildIngresoOrXml(args: {
  cfg: OcaConfig;
  operativa: string;
  order: ShipmentOrder;
  centroOrigen: string;
  centroCosto: string;
  defaults?: PackageDefaults;
  date?: Date;
}): string {
  const { cfg, order } = args;
  const pkg = shipmentPackage(order.items, args.defaults);
  const addr = order.address;
  const provincia = normalizeProvince(addr.province);
  const localidad = normalizeCity(addr.city, provincia);
  const { piso, depto } = parseApartment(addr.apartment);
  const origStreet = removeAccents((cfg.originStreet ?? "").toUpperCase());
  const origCity = removeAccents((cfg.originCity ?? "").toUpperCase());
  const origProvince = removeAccents((cfg.originProvince ?? "").toUpperCase());
  const origContact = removeAccents(cfg.originContact ?? "");
  const e = escapeXml;
  const phone = e((order.phone || "").trim());

  return (
    `<?xml version="1.0" encoding="iso-8859-1" standalone="yes"?><ROWS>` +
    `<cabecera ver="2.0" nrocuenta="${e(cfg.nroCliente ?? "")}" origen="API" />` +
    `<origenes><origen calle="${e(origStreet)}" nro="${e(cfg.originNumber ?? "")}" piso="${e(cfg.originFloor ?? "")}" depto="" cp="${e(cfg.originZipCode ?? "")}" localidad="${e(origCity)}" provincia="${e(origProvince)}" contacto="${e(origContact)}" email="${e(sanitizeEmail(cfg.originEmail))}" solicitante="" observaciones="" centrocosto="${e(args.centroCosto)}" idfranjahoraria="${e(cfg.franjaHoraria || "1")}" idcentroimposicionorigen="${e(args.centroOrigen)}" fecha="${ocaDate(args.date)}">` +
    `<envios><envio idoperativa="${e(args.operativa)}" nroremito="${order.orderNumber}">` +
    `<destinatario apellido="${e(removeAccents(order.lastName.trim()))}" nombre="${e(removeAccents(order.firstName.trim()))}" calle="${e(removeAccents((addr.street ?? "").trim()))}" nro="${e((addr.number ?? "").trim())}" piso="${e(piso)}" depto="${e(depto)}" localidad="${e(localidad)}" provincia="${e(provincia)}" cp="${e((addr.zipCode ?? "").trim())}" telefono="${phone}" email="${e(sanitizeEmail(order.email))}" idci="${e(addr.branchId || "0")}" celular="${phone}" observaciones="" />` +
    `<paquetes><paquete alto="${pkg.altoCm}" ancho="${pkg.anchoCm}" largo="${pkg.largoCm}" peso="${pkg.pesoKg}" valor="0" cant="1" /></paquetes>` +
    `</envio></envios></origen></origenes></ROWS>`
  );
}

// Interpreta la respuesta de IngresoORMultiplesRetiros: devuelve el número de orden de retiro o lanza el motivo
export async function parseIngresoOrResponse(xml: string): Promise<string> {
  const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false, tagNameProcessors: [strip] });

  // Formato "viejo" de errores (credenciales, estructura)
  const legacy = findDeep(parsed, "Descripcion");
  if (typeof legacy === "string" && legacy.trim()) throw new OcaError(`OCA: ${legacy}`);

  const resultado = parsed?.DataSet?.diffgram?.Resultado;
  const resumen = resultado?.Resumen;
  const ingresados = Number(resumen?.CantidadIngresados ?? 0);
  const rechazados = Number(resumen?.CantidadRechazados ?? 0);
  if (rechazados > 0 && ingresados === 0) {
    const det = resultado?.DetalleRechazos;
    const motivo = Array.isArray(det) ? det[0]?.Motivo : det?.Motivo;
    throw new OcaError(`OCA rechazó el envío: ${motivo || "sin motivo"}`);
  }
  const detalle = resultado?.DetalleIngresos;
  const orden = Array.isArray(detalle) ? detalle[0]?.OrdenRetiro : detalle?.OrdenRetiro;
  const nro = orden || resumen?.CodigoOperacion || null;
  if (!nro || Number.isNaN(Number(nro))) throw new OcaError("OCA no devolvió un número de orden válido");
  return String(nro);
}

export async function ocaIngresoOr(cfg: OcaConfig, order: ShipmentOrder, deps: Deps & { defaults?: PackageDefaults } = {}): Promise<{ nroOR: string }> {
  const operativa = order.isBranch ? cfg.operativaSucursal || cfg.operativa : cfg.operativa;
  if (!cfg.user || !cfg.password || !cfg.nroCliente || !operativa) {
    throw new OcaError("Configuración de OCA incompleta: revisá usuario, contraseña, número de cliente y operativa en Envíos → OCA.");
  }
  const cuit = cfg.cuit ?? "";
  const [centroOrigen, cc] = await Promise.all([centroImposicionOrigen(cfg.originZipCode ?? "", deps), centroCosto(cuit, operativa, deps)]);
  const xml = buildIngresoOrXml({ cfg, operativa, order, centroOrigen, centroCosto: cc, defaults: deps.defaults });
  const res = await (deps.fetchImpl ?? fetch)(`https://${BASE}/ePak_tracking/Oep_TrackEPak.asmx/IngresoORMultiplesRetiros`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr: cfg.user, psw: cfg.password, XML_Datos: xml, ConfirmarRetiro: "true", ArchivoCliente: "", ArchivoProceso: "" }).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new OcaError("No pudimos conectar con OCA para registrar el envío");
  });
  return { nroOR: await parseIngresoOrResponse(await res.text()) };
}

// ---------- Rótulo ----------

export async function ocaLabelPdf(nroOR: string, deps: Deps = {}): Promise<Buffer> {
  const res = await get(
    `https://${BASE}/epak_tracking/Oep_Trackepak.asmx/GetPdfDeEtiquetasPorOrdenOrNumeroEnvio?idOrdenRetiro=${encodeURIComponent(nroOR)}&nroEnvio=&logisticaInversa=false`,
    deps
  ).catch(() => {
    throw new OcaError("No pudimos conectar con OCA para pedir el rótulo");
  });
  if (!res.ok) throw new OcaError("No se pudo obtener el rótulo de OCA");
  const contentType = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  // Para este servicio OCA devuelve el PDF en base64 dentro de un XML
  if (contentType.includes("xml") || contentType.includes("text")) {
    const text = buffer.toString("utf8");
    const match = text.match(/<[^>]+>([A-Za-z0-9+/=\s]{100,})<\/[^>]+>/);
    if (!match) throw new OcaError("OCA no devolvió un PDF válido");
    return Buffer.from(match[1].replace(/\s/g, ""), "base64");
  }
  return buffer;
}
