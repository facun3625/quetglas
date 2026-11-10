import { prisma } from '@/lib/prisma';
import { getProductForEdit, getFormOptions, getRelatedNames } from '../../src/app/admin/(dashboard)/productos/formData';
async function main() {
  const products = await prisma.product.findMany({ select: { id: true, name: true, type: true, wooId: true } });
  console.log('productos en la base de prueba:', products.length);
  await getFormOptions();
  for (const p of products) {
    try {
      const data = await getProductForEdit(p.id);
      if (!data) throw new Error('null');
      await getRelatedNames(data.relatedIds);
      JSON.stringify(data);
      console.log('OK  ', p.type, p.name);
    } catch (e) { console.log('FALLA', p.type, p.name, '->', (e as Error).message); }
  }
  await prisma.$disconnect();
}
main();
