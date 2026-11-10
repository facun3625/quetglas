import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

// Almacenamiento de imágenes del catálogo. Producción: Cloudflare R2 (API
// compatible con S3, URL pública propia). Si R2 no está configurado (desarrollo)
// se guarda en disco y se sirve desde /api/uploads/products/<archivo>.
//
// Variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
// R2_PUBLIC_URL (dominio público del bucket, sin barra final).

export type StoredImage = { url: string; thumbUrl: string };

const MAX_SIDE = 1600;
const THUMB_SIDE = 400;
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads", "products");

// ---------- Configuración de R2 ----------
// Prioridad: lo cargado en el panel (Configuración → Imágenes) y, si no hay, las variables de entorno R2_*.
// Sin ninguna de las dos, se guarda en el disco local (desarrollo).
export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicUrl: string; source: "panel" | "entorno" };

let configCache: { at: number; value: R2Config | null } | null = null;
const CONFIG_TTL_MS = 30_000;

export function invalidateR2Cache() {
  configCache = null;
}

export async function getR2Config(): Promise<R2Config | null> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
  let value: R2Config | null = null;
  try {
    const row = await prisma.storeSettings.findUnique({ where: { id: "global" } });
    if (row?.r2AccountId && row.r2AccessKeyId && row.r2SecretAccessKey && row.r2Bucket && row.r2PublicUrl) {
      value = { accountId: row.r2AccountId, accessKeyId: row.r2AccessKeyId, secretAccessKey: row.r2SecretAccessKey, bucket: row.r2Bucket, publicUrl: row.r2PublicUrl.replace(/\/$/, ""), source: "panel" };
    }
  } catch {
    /* sin base disponible: se prueba con el entorno */
  }
  if (!value && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL) {
    value = {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL.replace(/\/$/, ""),
      source: "entorno",
    };
  }
  configCache = { at: Date.now(), value };
  return value;
}

export async function isR2Configured(): Promise<boolean> {
  return (await getR2Config()) !== null;
}

const clients = new Map<string, S3Client>();
export function r2Client(cfg: Pick<R2Config, "accountId" | "accessKeyId" | "secretAccessKey">): S3Client {
  const key = `${cfg.accountId}:${cfg.accessKeyId}:${cfg.secretAccessKey.slice(-6)}`;
  let c = clients.get(key);
  if (!c) {
    c = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    clients.set(key, c);
  }
  return c;
}

async function put(key: string, body: Buffer): Promise<string> {
  const cfg = await getR2Config();
  if (cfg) {
    await r2Client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${cfg.publicUrl}/${key}`;
  }
  const file = key.replace(/\//g, "_");
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, file), body);
  return `/api/uploads/products/${file}`;
}

// Normaliza cualquier imagen (jpg/png/webp/gif/avif) a WebP: versión
// principal (máx. 1600px) y miniatura (400px). Rechaza lo que no sea imagen.
export async function storeImage(input: Buffer): Promise<StoredImage> {
  let main: Buffer;
  let thumb: Buffer;
  try {
    const base = sharp(input, { failOn: "error", limitInputPixels: 100_000_000 }).rotate();
    [main, thumb] = await Promise.all([
      base.clone().resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
      base.clone().resize(THUMB_SIDE, THUMB_SIDE, { fit: "cover" }).webp({ quality: 78 }).toBuffer(),
    ]);
  } catch {
    throw new Error("El archivo no es una imagen válida");
  }
  const id = randomUUID();
  const day = new Date().toISOString().slice(0, 7); // aaaa-mm
  const [url, thumbUrl] = await Promise.all([put(`products/${day}/${id}.webp`, main), put(`products/${day}/${id}-thumb.webp`, thumb)]);
  return { url, thumbUrl };
}

// ---------- Videos de portada ----------
// Se guardan tal cual (sin transcodificar): mp4 o webm, hasta 50 MB (el límite de nginx). R2 en producción; en
// desarrollo, en disco y servidos por /api/uploads/videos/<archivo> con soporte de rangos (necesario para reproducir).
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const LOCAL_VIDEO_DIR = path.join(process.cwd(), "public", "uploads", "videos");

export function detectVideoType(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length > 12 && buf.subarray(4, 8).toString("ascii") === "ftyp") return "mp4";
  if (buf.length > 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

export async function storeVideo(input: Buffer): Promise<{ url: string }> {
  const type = detectVideoType(input);
  if (!type) throw new Error("El archivo no es un video válido (usá .mp4 o .webm)");
  if (input.length > MAX_VIDEO_BYTES) throw new Error("El video supera los 50 MB: comprimilo o usá un enlace");
  const name = `${randomUUID()}.${type}`;
  const day = new Date().toISOString().slice(0, 7);
  const cfg = await getR2Config();
  if (cfg) {
    await r2Client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: `videos/${day}/${name}`,
        Body: input,
        ContentType: type === "mp4" ? "video/mp4" : "video/webm",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return { url: `${cfg.publicUrl}/videos/${day}/${name}` };
  }
  await mkdir(LOCAL_VIDEO_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_VIDEO_DIR, name), input);
  return { url: `/api/uploads/videos/${name}` };
}
