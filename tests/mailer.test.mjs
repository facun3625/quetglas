import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loader } from './helpers/loader.mjs';

const { smtpSecureFor, friendlySmtpError } = loader({ '@/lib/settings': { getStoreSettingsRow: async () => ({}) }, '@/lib/usage': { addUsage: async () => {} } })('@/lib/mailer');

test('SMTP: el TLS directo se decide por el puerto (587 = STARTTLS, 465 = TLS)', () => {
  assert.equal(smtpSecureFor(465, false), true);
  assert.equal(smtpSecureFor(587, true), false, 'tildar TLS con el 587 era el error "wrong version number"');
  assert.equal(smtpSecureFor(587, false), false);
  assert.equal(smtpSecureFor(25, true), false);
  assert.equal(smtpSecureFor(1234, true), true, 'puerto raro: se respeta lo tildado');
  assert.equal(smtpSecureFor(null, false), false);
});

test('SMTP: errores técnicos en lenguaje claro', () => {
  assert.match(friendlySmtpError('80BC94EE0B790000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number'), /puerto 587/);
  assert.match(friendlySmtpError('Invalid login: 535 Authentication failed'), /contraseña/);
  assert.match(friendlySmtpError('connect ETIMEDOUT 1.2.3.4:587'), /No se pudo conectar/);
  assert.equal(friendlySmtpError('otra cosa'), 'otra cosa');
});
