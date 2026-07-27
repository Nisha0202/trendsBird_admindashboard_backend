import { prisma } from '../config/prisma';
import bcrypt from 'bcrypt';

async function main() {
  const group = await prisma.permissionGroup.create({
    data: { name: 'TestModule', description: 'Temporary test group' },
  });

  const perm = await prisma.permission.create({
    data: { name: 'testmodule:read', groupId: group.id },
  });

  const role = await prisma.role.create({
    data: {
      name: 'Test Role',
      permissions: { create: [{ permissionId: perm.id }] },
    },
  });

  const hash = await bcrypt.hash('Test1234!', 10);
  const user = await prisma.user.create({
    data: { name: 'Test User', email: 'test@example.com', passwordHash: hash, roleId: role.id },
  });

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  console.log(JSON.stringify(full, null, 2));

  // cleanup
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.role.delete({ where: { id: role.id } });
  await prisma.permission.delete({ where: { id: perm.id } });
  await prisma.permissionGroup.delete({ where: { id: group.id } });
  console.log('Cleaned up test data.');
}

main().finally(() => prisma.$disconnect());