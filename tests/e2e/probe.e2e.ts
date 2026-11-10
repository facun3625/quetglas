import assert from 'node:assert/strict';
import { probeVideo } from '@/app/admin/(dashboard)/temas/actions';
async function main() {
  const photos = await probeVideo('https://photos.app.goo.gl/3qfhtdBKMy64V3bC6');
  assert.equal(photos.ok, false); assert.match(photos.message, /Google Fotos/);
  const page = await probeVideo('https://example.com/');
  console.log('example.com ->', page);
  assert.equal(page.ok, false);
  assert.equal((await probeVideo('https://localhost/a.mp4')).ok, false);
  assert.equal((await probeVideo('https://127.0.0.1/a.mp4')).ok, false);
  assert.equal((await probeVideo('/api/uploads/videos/49282e32-f989-498f-a6b2-43de2c4530aa.mp4')).ok, true);
  console.log('probe e2e OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
