import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Las copias van cifradas (AES-256-GCM) porque pueden quedar en un bucket público de R2 y
// tienen datos de clientes. Formato: "CPBK1\n" + sal(16) + iv(12) + tag(16) + datos cifrados.
// La clave sale de BACKUP_SECRET: sin ese secreto una copia no se puede abrir.
const MAGIC = Buffer.from("CPBK1\n");

export function isEncryptedBackup(buf: Buffer): boolean {
  return buf.length > MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

export function encryptBackup(plain: Buffer, secret: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(secret, salt, 32), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(enc: Buffer, secret: string): Buffer {
  if (!isEncryptedBackup(enc)) throw new Error("El archivo no es una copia de seguridad cifrada");
  let o = MAGIC.length;
  const salt = enc.subarray(o, (o += 16));
  const iv = enc.subarray(o, (o += 12));
  const tag = enc.subarray(o, (o += 16));
  const decipher = createDecipheriv("aes-256-gcm", scryptSync(secret, salt, 32), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(enc.subarray(o)), decipher.final()]);
  } catch {
    throw new Error("No se pudo descifrar: el BACKUP_SECRET no es el de esta copia, o el archivo está dañado");
  }
}
