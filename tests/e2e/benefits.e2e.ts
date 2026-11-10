import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { saveHomeBenefits } from '../../src/app/admin/(dashboard)/configuracion/actions';

async function main() {
  await prisma.storeSettings.deleteMany();
  const r = await saveHomeBenefits([{ icon: 'truck', title: 'Envíos', subtitle: 'A todo el país' }, { icon: 'zzz', title: 'Otro', subtitle: '' }, { icon: 'star', title: '', subtitle: '' }]);
  assert.equal(r.ok, true);
  let row = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 'global' } });
  assert.deepEqual(row.homeBenefits, [{ icon: 'truck', title: 'Envíos', subtitle: 'A todo el país' }, { icon: 'tag', title: 'Otro', subtitle: '' }]);
  // vaciar = vuelve a la franja original (null en la base)
  await saveHomeBenefits([]);
  row = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 'global' } });
  assert.equal(row.homeBenefits, null);
  console.log('benefits e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
