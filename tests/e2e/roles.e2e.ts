import assert from 'node:assert/strict';
import { prisma } from '@/lib/prisma';
import { getCustomerRows } from '@/lib/customers';
import { setUserRole, deleteUser, createAdminUser } from '@/app/admin/(dashboard)/usuarios/actions';
import { isStaff, isSuperAdmin } from '@/lib/roles';

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE "User","AdminLog" CASCADE');
  const sup = await prisma.user.create({ data: { email: 'facundoarteagasola@gmail.com', name: 'Facundo', role: 'superadmin' } });
  const adm = await prisma.user.create({ data: { email: 'dueno@tienda.com', name: 'Dueña', role: 'admin' } });
  const cli = await prisma.user.create({ data: { email: 'cliente@example.com', name: 'Cliente' } });

  assert.equal(isStaff('admin') && isStaff('superadmin') && !isStaff('customer'), true);
  assert.equal(isSuperAdmin('superadmin') && !isSuperAdmin('admin'), true);

  // El administrador no ve al superadministrador; el superadministrador sí
  const asAdmin = (await getCustomerRows({ includeAdmins: true })).map((r) => r.email);
  assert.deepEqual(asAdmin.sort(), ['cliente@example.com', 'dueno@tienda.com']);
  const asSuper = (await getCustomerRows({ includeAdmins: true, includeSuperAdmin: true })).map((r) => r.email);
  assert.equal(asSuper.includes('facundoarteagasola@gmail.com'), true);
  assert.equal((await getCustomerRows({ onlyUserIds: [sup.id], includeAdmins: true })).length, 0);

  // Nadie toca la cuenta del superadministrador desde el panel
  await assert.rejects(setUserRole(sup.id, 'customer'));
  await assert.rejects(deleteUser(sup.id));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: sup.id } })).role, 'superadmin');

  // Crear administradores desde el panel
  assert.equal((await createAdminUser({ name: 'Nuevo', email: 'nuevo@tienda.com', password: 'corta' })).ok, false, 'contraseña corta');
  assert.equal((await createAdminUser({ name: 'Nuevo', email: 'no-es-mail', password: 'unaclavelarga' })).ok, false);
  assert.equal((await createAdminUser({ name: 'Nuevo', email: 'Nuevo@Tienda.com', password: 'unaclavelarga' })).ok, true);
  const nuevo = await prisma.user.findUniqueOrThrow({ where: { email: 'nuevo@tienda.com' } });
  assert.equal(nuevo.role, 'admin'); assert.ok(nuevo.passwordHash && nuevo.passwordHash !== 'unaclavelarga');
  assert.equal((await createAdminUser({ name: '', email: 'nuevo@tienda.com', password: 'unaclavelarga' })).ok, false, 'ya es admin');
  assert.equal((await createAdminUser({ name: '', email: 'facundoarteagasola@gmail.com', password: 'unaclavelarga' })).ok, false, 'no se puede usar el del super');
  // email de un cliente existente: pasa a admin y conserva su cuenta
  assert.equal((await createAdminUser({ name: '', email: 'cliente@example.com', password: '' })).ok, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: cli.id } })).role, 'admin');
  // promover / quitar rol
  await setUserRole(cli.id, 'customer'); assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: cli.id } })).role, 'customer');
  await deleteUser(adm.id); assert.equal(await prisma.user.count({ where: { id: adm.id } }), 0);

  console.log('roles e2e OK');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
