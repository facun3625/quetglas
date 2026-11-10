import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, type R2Config } from "@/lib/storage";

// Validación de los datos de R2 antes de guardarlos o probarlos (devuelve el motivo si algo está mal)
export function validateR2Fields(f: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicUrl: string }): string | null {
  if (!/^[0-9a-f]{32}$/i.test(f.accountId.trim())) return "El Account ID tiene que ser el código de 32 caracteres de tu cuenta de Cloudflare.";
  if (!f.accessKeyId.trim()) return "Falta el Access Key ID.";
  if (!f.secretAccessKey.trim()) return "Falta el Secret Access Key.";
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(f.bucket.trim())) return "El nombre del bucket no es válido (minúsculas, números y guiones).";
  if (!/^https:\/\/[A-Za-z0-9.-]+(:\d+)?(\/[A-Za-z0-9._~/-]*)?$/.test(f.publicUrl.trim())) return "La URL pública tiene que empezar con https:// (por ejemplo https://img.tudominio.com).";
  return null;
}

type Client = { send: (cmd: never) => Promise<unknown> };
type Deps = { client?: Client; fetchImpl?: typeof fetch };

// Prueba de punta a punta: sube un archivito, lo pide por la URL pública y lo borra.
export async function testR2Connection(cfg: Omit<R2Config, "source">, deps: Deps = {}): Promise<{ ok: boolean; message: string }> {
  const invalid = validateR2Fields(cfg);
  if (invalid) return { ok: false, message: invalid };
  const client = deps.client ?? (r2Client(cfg) as unknown as Client);
  const key = `_prueba/conexion-${Date.now()}.txt`;
  const body = `prueba ${new Date().toISOString()}`;

  try {
    await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: "text/plain" }) as never);
  } catch (err) {
    const name = (err as { name?: string; Code?: string }).name ?? (err as { Code?: string }).Code ?? "";
    if (/NoSuchBucket/i.test(name)) return { ok: false, message: "No existe un bucket con ese nombre en esa cuenta." };
    if (/InvalidAccessKeyId|SignatureDoesNotMatch|Forbidden|AccessDenied|Unauthorized/i.test(name)) {
      return { ok: false, message: "Cloudflare rechazó las claves: revisá el Access Key ID, el Secret y que la clave tenga permiso de escritura sobre ese bucket." };
    }
    return { ok: false, message: "No se pudo conectar con R2. Revisá el Account ID y las claves." };
  }

  let visible = false;
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${cfg.publicUrl.replace(/\/$/, "")}/${key}`, { signal: AbortSignal.timeout(10000) });
    visible = res.ok && (await res.text()).startsWith("prueba ");
  } catch {
    visible = false;
  }
  await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }) as never).catch(() => undefined);

  if (!visible) {
    return { ok: false, message: "Las claves funcionan y se pudo subir, pero la URL pública no muestra el archivo. Revisá que el bucket tenga el acceso público (o dominio propio) activado y que la URL pública sea la correcta." };
  }
  return { ok: true, message: "Conexión perfecta: se pudo subir, ver por la URL pública y borrar un archivo de prueba." };
}
