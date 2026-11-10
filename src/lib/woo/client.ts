import { assertPublicHost } from "@/lib/remoteImage";

// Cliente de solo lectura de la API REST v3 de WooCommerce. Las credenciales
// viven únicamente en memoria durante la corrida (nunca se guardan).
export type WooCredentials = { baseUrl: string; consumerKey: string; consumerSecret: string };

export class WooError extends Error {}

export type WooClient = {
  baseUrl: string;
  get<T>(path: string, params?: Record<string, string | number>): Promise<{ data: T; total: number; totalPages: number }>;
  paged<T>(path: string, params?: Record<string, string | number>): AsyncGenerator<T[]>;
};

type Deps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; checkHost?: boolean };

export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new WooError("La URL de la tienda no es válida");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new WooError("La URL debe empezar con https://");
  // Acepta que peguen la URL de la API completa o una página cualquiera de la tienda
  return `${url.origin}${url.pathname.replace(/\/wp-json.*$/, "").replace(/\/$/, "")}`;
}

export function createWooClient(creds: WooCredentials, deps: Deps = {}): WooClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const baseUrl = normalizeBaseUrl(creds.baseUrl);
  const secure = baseUrl.startsWith("https:");
  const authHeader = "Basic " + Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  async function get<T>(path: string, params: Record<string, string | number> = {}) {
    const url = new URL(`${baseUrl}/wp-json/wc/v3/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    // Por HTTP, WooCommerce no acepta Basic: pide las claves por query string
    if (!secure) {
      url.searchParams.set("consumer_key", creds.consumerKey);
      url.searchParams.set("consumer_secret", creds.consumerSecret);
    }
    if (deps.checkHost !== false) {
      try {
        await assertPublicHost(url);
      } catch {
        throw new WooError("La dirección de la tienda no es accesible desde internet");
      }
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
      try {
        const res = await fetchImpl(url, {
          headers: { Accept: "application/json", ...(secure ? { Authorization: authHeader } : {}) },
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 401 || res.status === 403) {
          throw new WooError("Credenciales inválidas o sin permiso de lectura. Usá claves de la API con permiso de lectura.");
        }
        if (res.status === 404) {
          throw new WooError("No se encontró la API de WooCommerce. Revisá la URL y que los enlaces permanentes no estén en 'Simple'.");
        }
        if (res.status === 429 || res.status >= 500) {
          lastError = new WooError(`La tienda respondió ${res.status}`);
          continue;
        }
        if (!res.ok) throw new WooError(`La tienda respondió ${res.status}`);
        const data = (await res.json()) as T;
        return {
          data,
          total: Number(res.headers.get("x-wp-total") ?? (Array.isArray(data) ? data.length : 0)),
          totalPages: Number(res.headers.get("x-wp-totalpages") ?? 1),
        };
      } catch (err) {
        if (err instanceof WooError && !/respondió (429|5\d\d)/.test(err.message)) throw err;
        lastError = err;
      }
    }
    throw lastError instanceof WooError ? lastError : new WooError("No se pudo conectar con la tienda");
  }

  async function* paged<T>(path: string, params: Record<string, string | number> = {}) {
    for (let page = 1; ; page++) {
      const { data, totalPages } = await get<T[]>(path, { per_page: 50, ...params, page });
      if (data.length > 0) yield data;
      if (page >= totalPages || data.length === 0) return;
    }
  }

  return { baseUrl, get, paged };
}
