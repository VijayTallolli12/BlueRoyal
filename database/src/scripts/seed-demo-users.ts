import bcrypt from 'bcryptjs';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/db';

interface DemoAccountConfig {
  email: string;
  roleName: 'super_admin' | 'hr_admin' | 'employee';
  firstName: string;
  lastName: string;
  envPasswordKey: string;
  defaultPasswordPrefix: string;
}

const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    email: 'superadmin@blueroyal.com',
    roleName: 'super_admin',
    firstName: 'Demo',
    lastName: 'SuperAdmin',
    envPasswordKey: 'DEMO_SUPERADMIN_PASSWORD',
    defaultPasswordPrefix: 'BR-SuperAdmin',
  },
  {
    email: 'hradmin@blueroyal.com',
    roleName: 'hr_admin',
    firstName: 'Demo',
    lastName: 'HrAdmin',
    envPasswordKey: 'DEMO_HRADMIN_PASSWORD',
    defaultPasswordPrefix: 'BR-HrAdmin',
  },
  {
    email: 'employee@blueroyal.com',
    roleName: 'employee',
    firstName: 'Demo',
    lastName: 'Employee',
    envPasswordKey: 'DEMO_EMPLOYEE_PASSWORD',
    defaultPasswordPrefix: 'BR-Employee',
  },
];

function getOrGeneratePassword(config: DemoAccountConfig): string {
  const envVal = process.env[config.envPasswordKey];
  if (envVal && envVal.trim().length >= 8) {
    return envVal.trim();
  }
  // Standard presentation-ready development credentials
  if (config.roleName === 'super_admin') return 'SuperAdmin@2026!';
  if (config.roleName === 'hr_admin') return 'HrAdmin@2026!';
  if (config.roleName === 'employee') return 'Employee@2026!';
  return `${config.defaultPasswordPrefix}#2026!`;
}

export async function seedDemoUsers(): Promise<Record<string, { role: string; email: string; password: string }>> {
  console.log('\n======================================================');
  console.log('   Blue Royal HRMS — Development Demo Accounts Seeder ');
  console.log('======================================================\n');

  const credentialsOutput: Record<string, { role: string; email: string; password: string }> = {};

  try {
    await sequelize.authenticate();

    // Migrate any existing .local demo accounts to .com to ensure no legacy addresses remain
    await sequelize.query(`
      UPDATE users u1
      SET email = REPLACE(u1.email, '@blueroyal.local', '@blueroyal.com')
      WHERE u1.email LIKE '%@blueroyal.local'
        AND NOT EXISTS (
          SELECT 1 FROM users u2 WHERE u2.email = REPLACE(u1.email, '@blueroyal.local', '@blueroyal.com')
        );
    `);
    await sequelize.query(`
      DELETE FROM users WHERE email LIKE '%@blueroyal.local';
    `);
    await sequelize.query(`
      UPDATE employees e1
      SET email = REPLACE(e1.email, '@blueroyal.local', '@blueroyal.com')
      WHERE e1.email LIKE '%@blueroyal.local'
        AND NOT EXISTS (
          SELECT 1 FROM employees e2 WHERE e2.email = REPLACE(e1.email, '@blueroyal.local', '@blueroyal.com')
        );
    `);
    await sequelize.query(`
      DELETE FROM employees WHERE email LIKE '%@blueroyal.local';
    `);

    // Verify confirmed roles exist
    const roles = await sequelize.query<{ id: string; name: string }>(
      'SELECT id, name FROM roles;',
      { type: QueryTypes.SELECT },
    );
    const roleMap = new Map<string, string>();
    for (const r of roles) {
      roleMap.set(r.name, r.id);
    }

    for (const acc of DEMO_ACCOUNTS) {
      const roleId = roleMap.get(acc.roleName);
      if (!roleId) {
        throw new Error(`Required role "${acc.roleName}" not found in database. Run baseline seed first.`);
      }

      const rawPassword = getOrGeneratePassword(acc);
      const passwordHash = await bcrypt.hash(rawPassword, 12);

      // 1. Upsert user in users table
      const existingUsers = await sequelize.query<{ id: string }>(
        'SELECT id FROM users WHERE email = :email;',
        { replacements: { email: acc.email }, type: QueryTypes.SELECT },
      );

      let userId: string;
      if (existingUsers.length === 0) {
        const insertRes = await sequelize.query<{ id: string }>(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), :email, :passwordHash, :firstName, :lastName, true, NOW(), NOW())
           RETURNING id;`,
          {
            replacements: {
              email: acc.email,
              passwordHash,
              firstName: acc.firstName,
              lastName: acc.lastName,
            },
            type: QueryTypes.SELECT,
          },
        );
        userId = insertRes[0].id;
      } else {
        userId = existingUsers[0].id;
        await sequelize.query(
          `UPDATE users SET
             password_hash = :passwordHash,
             first_name = :firstName,
             last_name = :lastName,
             is_active = true,
             updated_at = NOW()
           WHERE id = :userId;`,
          {
            replacements: {
              userId,
              passwordHash,
              firstName: acc.firstName,
              lastName: acc.lastName,
            },
            type: QueryTypes.RAW,
          },
        );
      }

      // 2. Ensure role assignment in user_roles
      // Remove any prior mismatched roles for clean demo state, then assign confirmed role
      await sequelize.query(
        'DELETE FROM user_roles WHERE user_id = :userId;',
        { replacements: { userId }, type: QueryTypes.RAW },
      );
      await sequelize.query(
        `INSERT INTO user_roles (user_id, role_id, created_at)
         VALUES (:userId, :roleId, NOW())
         ON CONFLICT DO NOTHING;`,
        { replacements: { userId, roleId }, type: QueryTypes.RAW },
      );

      // Ensure super_admin has all permissions mapped
      if (acc.roleName === 'super_admin') {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at)
           SELECT :roleId, p.id, NOW()
           FROM permissions p
           ON CONFLICT DO NOTHING;`,
          { replacements: { roleId }, type: QueryTypes.RAW },
        );
      }

      // 3. For employee account, link to employees table for self-service capability
      if (acc.roleName === 'employee') {
        const existingEmp = await sequelize.query<{ id: string }>(
          'SELECT id FROM employees WHERE user_id = :userId OR employee_code = :code;',
          { replacements: { userId, code: 'EMP-DEMO-001' }, type: QueryTypes.SELECT },
        );

        if (existingEmp.length === 0) {
          await sequelize.query(
            `INSERT INTO employees (
               id, employee_code, user_id, first_name, last_name, gender,
               date_of_birth, nationality, email, date_of_joining,
               employment_type, status, address, country, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), 'EMP-DEMO-001', :userId, :firstName, :lastName, 'male',
               '1995-06-15', 'Emirati', :email, '2026-01-01',
               'full_time', 'active', 'Business Bay, Dubai, UAE', 'United Arab Emirates', NOW(), NOW()
             );`,
            {
              replacements: {
                userId,
                firstName: acc.firstName,
                lastName: acc.lastName,
                email: acc.email,
              },
              type: QueryTypes.RAW,
            },
          );
        } else {
          await sequelize.query(
            `UPDATE employees SET
               user_id = :userId,
               first_name = :firstName,
               last_name = :lastName,
               email = :email,
               status = 'active',
               address = COALESCE(address, 'Business Bay, Dubai, UAE'),
               country = COALESCE(country, 'United Arab Emirates'),
               updated_at = NOW()
             WHERE id = :empId;`,
            {
              replacements: {
                empId: existingEmp[0].id,
                userId,
                firstName: acc.firstName,
                lastName: acc.lastName,
                email: acc.email,
              },
              type: QueryTypes.RAW,
            },
          );
        }
      }

      credentialsOutput[acc.roleName] = {
        role: acc.roleName,
        email: acc.email,
        password: rawPassword,
      };
    }

    // 4. Seed / Update Demo Clients and Projects without deleting existing records
    console.log('Seeding / updating demo clients and projects...');
    const demoClients = [
      {
        code: 'CLI-MASAOOD',
        name: 'MASAOOD',
        contactPerson: 'Robert',
        contactEmail: 'contact@masaood.com',
        contactPhone: '+971 2 642 4444',
        billingAddress: 'Abu Dhabi, United Arab Emirates',
        projectName: 'Masaood Marine Operations',
        projectCode: 'PRJ-MASAOOD-01',
        projectLocation: 'Mussafah, Abu Dhabi',
      },
      {
        code: 'CL-DEMO-01',
        name: 'Blue Royal Client Partner',
        contactPerson: 'John Smith',
        contactEmail: 'contact@blueroyalclient.demo',
        contactPhone: '+971 4 123 4567',
        billingAddress: 'Business Bay, Dubai, UAE',
        projectName: 'Downtown Dubai Project',
        projectCode: 'PRJ-DEMO-01',
        projectLocation: 'Downtown Dubai, UAE',
      },
    ];

    for (const dc of demoClients) {
      const existingClient = await sequelize.query<{ id: string }>(
        'SELECT id FROM clients WHERE code = :code;',
        { replacements: { code: dc.code }, type: QueryTypes.SELECT },
      );

      let clientId: string;
      if (existingClient.length === 0) {
        const clientRes = await sequelize.query<{ id: string }>(
          `INSERT INTO clients (id, code, name, contact_person, contact_email, contact_phone, billing_address, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), :code, :name, :contactPerson, :contactEmail, :contactPhone, :billingAddress, true, NOW(), NOW())
           RETURNING id;`,
          {
            replacements: {
              code: dc.code,
              name: dc.name,
              contactPerson: dc.contactPerson,
              contactEmail: dc.contactEmail,
              contactPhone: dc.contactPhone,
              billingAddress: dc.billingAddress,
            },
            type: QueryTypes.SELECT,
          },
        );
        clientId = clientRes[0].id;
      } else {
        clientId = existingClient[0].id;
        await sequelize.query(
          `UPDATE clients SET
             name = :name,
             contact_person = :contactPerson,
             contact_email = :contactEmail,
             contact_phone = :contactPhone,
             billing_address = :billingAddress,
             is_active = true,
             updated_at = NOW()
           WHERE id = :id;`,
          {
            replacements: {
              id: clientId,
              name: dc.name,
              contactPerson: dc.contactPerson,
              contactEmail: dc.contactEmail,
              contactPhone: dc.contactPhone,
              billingAddress: dc.billingAddress,
            },
            type: QueryTypes.RAW,
          },
        );
      }

      // Upsert associated project
      const existingProj = await sequelize.query<{ id: string }>(
        'SELECT id FROM projects WHERE code = :projectCode;',
        { replacements: { projectCode: dc.projectCode }, type: QueryTypes.SELECT },
      );

      if (existingProj.length === 0) {
        await sequelize.query(
          `INSERT INTO projects (id, client_id, code, name, site_location, status, created_at, updated_at)
           VALUES (gen_random_uuid(), :clientId, :projectCode, :projectName, :projectLocation, 'active', NOW(), NOW());`,
          {
            replacements: {
              clientId,
              projectCode: dc.projectCode,
              projectName: dc.projectName,
              projectLocation: dc.projectLocation,
            },
            type: QueryTypes.RAW,
          },
        );
      } else {
        await sequelize.query(
          `UPDATE projects SET
             name = :projectName,
             site_location = :projectLocation,
             client_id = :clientId,
             status = 'active',
             updated_at = NOW()
           WHERE id = :id;`,
          {
            replacements: {
              id: existingProj[0].id,
              clientId,
              projectName: dc.projectName,
              projectLocation: dc.projectLocation,
            },
            type: QueryTypes.RAW,
          },
        );
      }
    }

    // Display formatted credentials table once in console output
    console.log('+--------------------+-------------------------------+----------------------------------------+');
    console.log('| Role               | Demo Email Address            | Generated Development Password         |');
    console.log('+--------------------+-------------------------------+----------------------------------------+');
    for (const item of Object.values(credentialsOutput)) {
      const roleStr = item.role.padEnd(18, ' ');
      const emailStr = item.email.padEnd(29, ' ');
      const passStr = item.password.padEnd(38, ' ');
      console.log(`| ${roleStr} | ${emailStr} | ${passStr} |`);
    }
    console.log('+--------------------+-------------------------------+----------------------------------------+\n');
    console.log('NOTE: Store these credentials securely. Passwords are for local development/testing only.\n');

    return credentialsOutput;
  } catch (error) {
    console.error('Demo seeder failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDemoUsers()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async () => {
      await sequelize.close();
      process.exit(1);
    });
}
