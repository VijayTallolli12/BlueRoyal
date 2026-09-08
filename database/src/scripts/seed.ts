import bcrypt from 'bcryptjs';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/db';

interface RoleSeed {
  name: string;
  displayName: string;
  description: string;
  [key: string]: unknown;
}

interface PermissionSeed {
  code: string;
  description: string;
  module: string;
  [key: string]: unknown;
}

const CONFIRMED_ROLES: RoleSeed[] = [
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Complete system control, configuration, and administrative management',
  },
  {
    name: 'hr_admin',
    displayName: 'HR Admin',
    description: 'Human resources administrative access, employee records, and reporting',
  },
  {
    name: 'employee',
    displayName: 'Employee',
    description: 'Standard employee self-service access',
  },
];

const BASELINE_PERMISSIONS: PermissionSeed[] = [
  // Authentication & System
  { code: 'system:health', description: 'Access system health check metrics', module: 'system' },
  {
    code: 'system:configure',
    description: 'Configure system settings and parameters',
    module: 'system',
  },
  // Users & Identity
  { code: 'users:read', description: 'View user accounts and profiles', module: 'users' },
  { code: 'users:create', description: 'Create new user accounts', module: 'users' },
  { code: 'users:update', description: 'Update user accounts and profile data', module: 'users' },
  { code: 'users:delete', description: 'Deactivate or soft-delete user accounts', module: 'users' },
  // Roles & RBAC
  { code: 'roles:read', description: 'View roles and permission matrices', module: 'roles' },
  { code: 'roles:assign', description: 'Assign roles to user accounts', module: 'roles' },
  // Audit Logs
  { code: 'audit:read', description: 'View system audit trails and access logs', module: 'audit' },
];

async function seed(): Promise<void> {
  console.log('\n=== Starting Idempotent Database Seeding ===');

  try {
    await sequelize.authenticate();

    // 1. Seed Confirmed Roles
    console.log('Seeding confirmed roles...');
    for (const r of CONFIRMED_ROLES) {
      await sequelize.query(
        `INSERT INTO roles (id, name, display_name, description, created_at, updated_at)
         VALUES (gen_random_uuid(), :name, :displayName, :description, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           updated_at = NOW();`,
        { replacements: r, type: QueryTypes.RAW },
      );
    }

    // 2. Seed Baseline Permissions
    console.log('Seeding baseline permissions...');
    for (const p of BASELINE_PERMISSIONS) {
      await sequelize.query(
        `INSERT INTO permissions (id, code, description, module, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :description, :module, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
           description = EXCLUDED.description,
           module = EXCLUDED.module,
           updated_at = NOW();`,
        { replacements: p, type: QueryTypes.RAW },
      );
    }

    // 3. Map Permissions to Roles
    console.log('Mapping permissions to roles...');
    const allRoles = await sequelize.query<{ id: string; name: string }>(
      'SELECT id, name FROM roles;',
      { type: QueryTypes.SELECT },
    );
    const allPermissions = await sequelize.query<{ id: string; code: string }>(
      'SELECT id, code FROM permissions;',
      { type: QueryTypes.SELECT },
    );

    const superAdminRole = allRoles.find((r) => r.name === 'super_admin');
    const hrAdminRole = allRoles.find((r) => r.name === 'hr_admin');
    const employeeRole = allRoles.find((r) => r.name === 'employee');

    // Super Admin gets ALL permissions
    if (superAdminRole) {
      for (const perm of allPermissions) {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           VALUES (:roleId, :permissionId, NOW())
           ON CONFLICT DO NOTHING;`,
          {
            replacements: { roleId: superAdminRole.id, permissionId: perm.id },
            type: QueryTypes.RAW,
          },
        );
      }
    }

    // HR Admin gets user management, role viewing, audit reading, health
    if (hrAdminRole) {
      const hrCodes = [
        'system:health',
        'users:read',
        'users:create',
        'users:update',
        'roles:read',
        'roles:assign',
        'audit:read',
      ];
      for (const perm of allPermissions.filter((p) => hrCodes.includes(p.code))) {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           VALUES (:roleId, :permissionId, NOW())
           ON CONFLICT DO NOTHING;`,
          { replacements: { roleId: hrAdminRole.id, permissionId: perm.id }, type: QueryTypes.RAW },
        );
      }
    }

    // Employee gets basic health/status
    if (employeeRole) {
      const empCodes = ['system:health'];
      for (const perm of allPermissions.filter((p) => empCodes.includes(p.code))) {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           VALUES (:roleId, :permissionId, NOW())
           ON CONFLICT DO NOTHING;`,
          {
            replacements: { roleId: employeeRole.id, permissionId: perm.id },
            type: QueryTypes.RAW,
          },
        );
      }
    }

    // 4. Seed Initial Super Admin User
    console.log('Seeding initial super admin account...');
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@blueroyal.com';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456';
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const existingAdmin = await sequelize.query<{ id: string }>(
      'SELECT id FROM users WHERE email = :email;',
      { replacements: { email: adminEmail }, type: QueryTypes.SELECT },
    );

    let adminUserId: string;

    if (existingAdmin.length === 0) {
      const insertResult = await sequelize.query<{ id: string }>(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :email, :passwordHash, 'System', 'Administrator', true, NOW(), NOW())
         RETURNING id;`,
        { replacements: { email: adminEmail, passwordHash }, type: QueryTypes.SELECT },
      );
      adminUserId = insertResult[0].id;
      console.log(`Initial admin user created with email: ${adminEmail}`);
    } else {
      adminUserId = existingAdmin[0].id;
      console.log(`Admin user already exists with email: ${adminEmail}`);
    }

    // Assign Super Admin role to the initial admin user
    if (superAdminRole && adminUserId) {
      await sequelize.query(
        `INSERT INTO user_roles (user_id, role_id, created_at)
         VALUES (:userId, :roleId, NOW())
         ON CONFLICT DO NOTHING;`,
        { replacements: { userId: adminUserId, roleId: superAdminRole.id }, type: QueryTypes.RAW },
      );
    }

    console.log('=== Database Seeding Completed Successfully ===\n');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
