import 'dotenv/config'; // Loads .env into process.env
import bcrypt from 'bcrypt';
import { prisma } from '../src/config/prisma';

// Environment variables with fallback defaults
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@example.com';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'SuperAdmin123!';

const CATALOG_USER_EMAIL = process.env.SEED_CATALOG_USER_EMAIL ?? 'catalog@example.com';
const CATALOG_USER_PASSWORD = process.env.SEED_CATALOG_USER_PASSWORD ?? 'Catalog123!';

const MODULES: Record<string, string[]> = {
  Dashboard: ['watch'],
  Permission: ['watch', 'create', 'read', 'update', 'delete'],
  Role: ['watch', 'create', 'read', 'update', 'delete'],
  User: ['watch', 'create', 'read', 'update', 'delete'],
  Media: ['watch', 'read', 'upload', 'write', 'delete'],
  Category: ['watch', 'create', 'read', 'update', 'delete'],
  Brand: ['watch', 'create', 'read', 'update', 'delete'],
  Attribute: ['watch', 'create', 'read', 'update', 'delete'],
  Product: ['watch', 'create', 'read', 'update', 'delete'],
};

const CATALOG_MODULES = ['Dashboard', 'Media', 'Category', 'Brand', 'Attribute', 'Product'];

async function main() {
  const allPermissions: { id: string; name: string; module: string }[] = [];

  for (const [moduleName, actions] of Object.entries(MODULES)) {
    const group = await prisma.permissionGroup.upsert({
      where: { name: moduleName },
      update: {},
      create: { name: moduleName },
    });

    for (const action of actions) {
      const permName = `${moduleName.toLowerCase()}:${action}`;
      const perm = await prisma.permission.upsert({
        where: { name: permName },
        update: {},
        create: { name: permName, groupId: group.id },
      });
      allPermissions.push({ ...perm, module: moduleName });
    }
  }

  // --- Super Administrator: every permission ---
  const superRole = await prisma.role.upsert({
    where: { name: 'Super Administrator' },
    update: {},
    create: { name: 'Super Administrator', description: 'Full system access' },
  });

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superRole.id, permissionId: perm.id },
    });
  }

  const superPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const superUser = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { passwordHash: superPasswordHash, roleId: superRole.id, active: true },
    create: {
      name: 'Super Admin',
      email: SUPER_ADMIN_EMAIL,
      passwordHash: superPasswordHash,
      roleId: superRole.id,
    },
  });

  // --- Catalog Manager: deliberately limited ---
  const catalogRole = await prisma.role.upsert({
    where: { name: 'Catalog Manager' },
    update: {},
    create: { name: 'Catalog Manager', description: 'Catalog access only' },
  });

  const catalogPermissions = allPermissions.filter((p) => CATALOG_MODULES.includes(p.module));
  for (const perm of catalogPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: catalogRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: catalogRole.id, permissionId: perm.id },
    });
  }

  const catalogPasswordHash = await bcrypt.hash(CATALOG_USER_PASSWORD, 10);
  const catalogUser = await prisma.user.upsert({
    where: { email: CATALOG_USER_EMAIL },
    update: { passwordHash: catalogPasswordHash, roleId: catalogRole.id, active: true },
    create: {
      name: 'Catalog User',
      email: CATALOG_USER_EMAIL,
      passwordHash: catalogPasswordHash,
      roleId: catalogRole.id,
    },
  });

  // console.log('Seed complete.');
  // console.log(`Super admin: ${SUPER_ADMIN_EMAIL} ->`, superUser.id);
  // console.log(`Catalog user: ${CATALOG_USER_EMAIL} ->`, catalogUser.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());