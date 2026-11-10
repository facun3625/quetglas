import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { createAttribute, renameAttribute, addTerms, updateTerm, deleteTerm, deleteAttributeAction } from '../../src/app/admin/(dashboard)/atributos/actions';

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "Product","Attribute" CASCADE');
  assert.equal((await createAttribute({ name: '  ', terms: '' })).ok, false);
  const r = await createAttribute({ name: 'Talle', terms: 'S\nM\n\nL\nm\nRojo|#ff0000\nVerde|nada' });
  assert.equal(r.ok, true); const id = (r as { id: string }).id;
  let terms = await prisma.attributeTerm.findMany({ where: { attributeId: id }, orderBy: { sortOrder: 'asc' } });
  assert.deepEqual(terms.map((t) => t.name), ['S', 'M', 'L', 'Rojo', 'Verde'], 'sin vacíos ni repetidos (M/m)');
  assert.equal(terms[3].colorHex, '#ff0000'); assert.equal(terms[4].colorHex, null, 'color inválido se ignora');

  assert.equal((await createAttribute({ name: 'talle', terms: '' })).ok, true, 'mismo nombre: slug distinto');
  assert.equal((await prisma.attribute.count({ where: { slug: { startsWith: 'talle' } } })), 2);
  assert.equal((await renameAttribute(id, 'Talles')).ok, true);
  assert.equal((await renameAttribute(id, ' ')).ok, false);

  const add = await addTerms(id, 'XL\nS\nXXL');
  assert.equal(add.ok, true); assert.match((add as { message: string }).message, /2 valores \(1 ya existían\)/);
  assert.equal((await addTerms(id, 'S\nM')).ok, false, 'todos repetidos');
  terms = await prisma.attributeTerm.findMany({ where: { attributeId: id }, orderBy: { sortOrder: 'asc' } });
  assert.deepEqual(terms.map((t) => t.sortOrder), [0, 1, 2, 3, 4, 5, 6], 'los nuevos van al final, en orden');

  const m = terms.find((t) => t.name === 'M')!;
  assert.equal((await updateTerm(m.id, { name: 'Medio', colorHex: '#00ff00' })).ok, true);
  assert.equal((await updateTerm(m.id, { name: 'L', colorHex: '' })).ok, false, 'nombre ya existe');
  assert.equal((await prisma.attributeTerm.findUniqueOrThrow({ where: { id: m.id } })).colorHex, '#00ff00');

  // borrar un valor elimina las variantes que lo usan
  const p = await prisma.product.create({ data: { name: 'Remera', slug: 'remera', type: 'variable', price: 10 } });
  const s = terms.find((t) => t.name === 'S')!; const l = terms.find((t) => t.name === 'L')!;
  const vS = await prisma.variant.create({ data: { productId: p.id, price: 10, terms: { create: [{ termId: s.id }] } } });
  const vL = await prisma.variant.create({ data: { productId: p.id, price: 10, terms: { create: [{ termId: l.id }] } } });
  await deleteTerm(s.id);
  assert.equal(await prisma.variant.count({ where: { id: vS.id } }), 0); assert.equal(await prisma.variant.count({ where: { id: vL.id } }), 1);
  assert.equal(await prisma.attributeTerm.count({ where: { id: s.id } }), 0);

  await deleteAttributeAction(id);
  assert.equal(await prisma.attribute.count({ where: { id } }), 0); assert.equal(await prisma.attributeTerm.count({ where: { attributeId: id } }), 0);
  console.log('attributes e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
