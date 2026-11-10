import assert from 'node:assert/strict';
import https from 'node:https';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { sendPushToAll, sendPushToUser, getVapidPublicKey } from '@/lib/webPush';

// Servicio de push de mentira (https local con certificado propio) para comprobar de punta a punta lo que la tienda manda:
// cabeceras VAPID, cuerpo cifrado, y que las suscripciones dadas de baja (410) se borran solas.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function sub(endpoint: string, userId?: string) {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { endpoint, p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url'), ...(userId ? { userId } : {}) };
}

async function main() {
  await prisma.pushSubscription.deleteMany();
  await prisma.user.deleteMany({ where: { email: 'push-test@example.com' } });
  const dir = mkdtempSync(path.join(tmpdir(), 'push-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const seen: { url: string; headers: Record<string, unknown>; bytes: number }[] = [];
  const server = https.createServer({ key: readFileSync(path.join(dir, 'k.pem')), cert: readFileSync(path.join(dir, 'c.pem')) }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push({ url: req.url ?? '', headers: req.headers, bytes: Buffer.concat(chunks).length });
      res.statusCode = req.url === '/gone' ? 410 : req.url === '/boom' ? 500 : 201;
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `https://127.0.0.1:${(server.address() as { port: number }).port}`;

  const publicKey = await getVapidPublicKey();
  assert.ok(publicKey.length > 60, 'se generan las claves VAPID solas');
  assert.equal(await getVapidPublicKey(), publicKey, 'y quedan guardadas: siempre la misma');

  const user = await prisma.user.create({ data: { email: 'push-test@example.com', name: 'Prueba', role: 'customer' } });
  await prisma.pushSubscription.createMany({ data: [sub(`${base}/ok`, user.id), sub(`${base}/gone`), sub(`${base}/boom`), sub(`${base}/ok2`)] });

  const r = await sendPushToAll({ title: 'Oferta', body: 'Hasta 20% off', url: '/tienda?ofertas=1' });
  assert.equal(r.total, 4);
  assert.equal(r.sent, 2, 'salen las 2 que el servicio aceptó (201); la caída y la que dio error 500 no cuentan');
  assert.equal(seen.length, 4, 'se intentó con las 4');
  const ok = seen.find((s) => s.url === '/ok')!;
  assert.match(String(ok.headers.authorization), /^vapid t=.+, k=.+/, 'identificación VAPID');
  assert.equal(ok.headers['content-encoding'], 'aes128gcm', 'cuerpo cifrado');
  assert.ok(ok.bytes > 40, 'lleva el mensaje cifrado');
  assert.ok(Number(ok.headers.ttl) > 0, 'tiene vencimiento (TTL)');
  const left = (await prisma.pushSubscription.findMany()).map((s) => s.endpoint.replace(base, '')).sort();
  assert.deepEqual(left, ['/boom', '/ok', '/ok2'], 'la suscripción dada de baja (410) se borra sola; la que dio 500 se conserva');

  seen.length = 0;
  await sendPushToUser(user.id, { title: 'Recibimos tu pedido', body: '#0001' });
  assert.deepEqual(seen.map((s) => s.url), ['/ok'], 'el push de un pedido va solo a los dispositivos de ese cliente');

  console.log('push e2e OK');
  server.close();
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
