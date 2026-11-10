import { lookup } from "node:dns/promises";
import net from "node:net";

// Descarga de imágenes remotas (migración desde WooCommerce) con defensas
// contra SSRF: solo http(s), sin IPs privadas/locales, tope de tamaño y de
// tiempo, y los redirects se revalidan uno por uno.

const MAX_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

export async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("URL no permitida");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new Error("Host no permitido");
}

export async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new Error("Imagen demasiado grande");

    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Respuesta vacía");
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Imagen demasiado grande");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Demasiadas redirecciones");
}
