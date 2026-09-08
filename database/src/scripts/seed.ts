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
  { code: 'system:configure', description: 'Configure system settings and parameters', module: 'system' },
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

  // Phase 1: Designations
  { code: 'designations:read', description: 'View job designations', module: 'designations' },
  { code: 'designations:create', description: 'Create job designations', module: 'designations' },
  { code: 'designations:update', description: 'Update job designations', module: 'designations' },
  { code: 'designations:delete', description: 'Delete job designations', module: 'designations' },

  // Phase 1: Employees
  { code: 'employees:read', description: 'View employee records', module: 'employees' },
  { code: 'employees:create', description: 'Register new employee profiles', module: 'employees' },
  { code: 'employees:update', description: 'Update employee biographical details', module: 'employees' },
  { code: 'employees:delete', description: 'Deactivate or delete employee records', module: 'employees' },

  // Phase 1: Clients
  { code: 'clients:read', description: 'View commercial client profiles', module: 'clients' },
  { code: 'clients:create', description: 'Register new commercial clients', module: 'clients' },
  { code: 'clients:update', description: 'Update commercial client details', module: 'clients' },
  { code: 'clients:delete', description: 'Deactivate commercial clients', module: 'clients' },

  // Phase 1: Projects
  { code: 'projects:read', description: 'View client projects and job sites', module: 'projects' },
  { code: 'projects:create', description: 'Create new client projects', module: 'projects' },
  { code: 'projects:update', description: 'Update client project details', module: 'projects' },
  { code: 'projects:delete', description: 'Deactivate client projects', module: 'projects' },

  // Phase 1: Employee Assignments
  { code: 'assignments:read', description: 'View employee deployment assignments', module: 'assignments' },
  { code: 'assignments:create', description: 'Deploy employee to project with designation', module: 'assignments' },
  { code: 'assignments:update', description: 'Modify employee project deployment', module: 'assignments' },

  // Phase 1: Rates (Hourly Pay Rates & Client Billing Rates)
  { code: 'rates:read', description: 'View employee pay rates and client billing rates', module: 'rates' },
  { code: 'rates:create', description: 'Configure pay rates or client billing rates', module: 'rates' },
  { code: 'rates:update', description: 'Update pay rates or client billing rates', module: 'rates' },

  // Phase 1: Shifts & Rostering
  { code: 'shifts:read', description: 'View shift timings and roster assignments', module: 'shifts' },
  { code: 'shifts:create', description: 'Create work shifts or roster assignments', module: 'shifts' },
  { code: 'shifts:update', description: 'Update work shifts or roster assignments', module: 'shifts' },
  { code: 'shifts:delete', description: 'Deactivate work shifts', module: 'shifts' },

  // Phase 1: Company Calendar & Holidays (Company Configurable)
  { code: 'calendar:read', description: 'View weekly off settings and company holidays', module: 'calendar' },
  { code: 'calendar:create', description: 'Configure weekly off or public holidays', module: 'calendar' },
  { code: 'calendar:update', description: 'Update weekly off or public holidays', module: 'calendar' },
  { code: 'calendar:delete', description: 'Remove public holidays', module: 'calendar' },

  // Phase 1: Salary Components & Monthly Structures
  { code: 'salary:read', description: 'View salary components and compensation packages', module: 'salary' },
  { code: 'salary:create', description: 'Create salary components and employee salary structures', module: 'salary' },
  { code: 'salary:update', description: 'Update salary components and employee salary structures', module: 'salary' },

  // Phase 2: Attendance & Overtime
  { code: 'attendance:read', description: 'View attendance periods and records', module: 'attendance' },
  { code: 'attendance:create', description: 'Create attendance periods and records', module: 'attendance' },
  { code: 'attendance:import', description: 'Import attendance records from Excel spreadsheet', module: 'attendance' },
  { code: 'attendance:submit', description: 'Submit draft attendance periods for approval', module: 'attendance' },
  { code: 'attendance:approve', description: 'Approve submitted attendance periods', module: 'attendance' },
  { code: 'attendance:lock', description: 'Lock approved attendance periods for payroll processing', module: 'attendance' },
  { code: 'attendance:unlock', description: 'Unlock locked attendance periods with justification', module: 'attendance' },
  { code: 'attendance:self_read', description: 'View own attendance history and status', module: 'attendance' },

  // Phase 3: Leave Management & Entitlements
  { code: 'leave_types:read', description: 'View leave type catalogs', module: 'leave' },
  { code: 'leave_types:create', description: 'Create new leave types', module: 'leave' },
  { code: 'leave_types:update', description: 'Update leave type rules', module: 'leave' },
  { code: 'leave_types:delete', description: 'Deactivate leave types', module: 'leave' },
  { code: 'leave_balances:read', description: 'View employee leave balances', module: 'leave' },
  { code: 'leave_balances:manage', description: 'Allocate or adjust employee leave balances', module: 'leave' },
  { code: 'leave:read', description: 'View enterprise leave requests', module: 'leave' },
  { code: 'leave:create', description: 'Create leave request on behalf of employee', module: 'leave' },
  { code: 'leave:approve', description: 'Approve submitted leave requests', module: 'leave' },
  { code: 'leave:reject', description: 'Reject submitted leave requests', module: 'leave' },
  { code: 'leave:cancel', description: 'Cancel approved or pending leave requests', module: 'leave' },
  { code: 'leave:self_read', description: 'View own leave balances and requests', module: 'leave' },
  { code: 'leave:self_create', description: 'Submit own leave request', module: 'leave' },
  { code: 'leave:self_cancel', description: 'Cancel own pending leave request', module: 'leave' },
];

const DEFAULT_DESIGNATIONS = [
  { code: 'DES-FOREMAN', title: 'Site Foreman', description: 'On-site construction and operations supervisor' },
  { code: 'DES-ELEC', title: 'Electrician', description: 'Certified electrical systems technician' },
  { code: 'DES-PLUMB', title: 'Plumber', description: 'Plumbing and piping technician' },
  { code: 'DES-CARP', title: 'Carpenter', description: 'Carpentry and woodwork craftsman' },
  { code: 'DES-ENG', title: 'Site Engineer', description: 'Field engineering and quality controller' },
  { code: 'DES-HELPER', title: 'General Helper', description: 'General site support and labor assistant' },
];

const DEFAULT_SALARY_COMPONENTS = [
  {
    code: 'BASIC',
    name: 'Basic Salary',
    type: 'earning',
    calculationType: 'fixed_amount',
    isRecurring: true,
    isWpsBasic: true,
    isWpsHousing: false,
  },
  {
    code: 'HRA',
    name: 'House Rent Allowance',
    type: 'earning',
    calculationType: 'fixed_amount',
    isRecurring: true,
    isWpsBasic: false,
    isWpsHousing: true,
  },
  {
    code: 'TRANSPORT',
    name: 'Transport Allowance',
    type: 'earning',
    calculationType: 'fixed_amount',
    isRecurring: true,
    isWpsBasic: false,
    isWpsHousing: false,
  },
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

    // 2. Seed Baseline & Phase 1 Permissions
    console.log('Seeding permissions...');
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

    // HR Admin gets operational permissions
    if (hrAdminRole) {
      const hrModules = [
        'system',
        'users',
        'roles',
        'audit',
        'designations',
        'employees',
        'clients',
        'projects',
        'assignments',
        'rates',
        'shifts',
        'calendar',
        'salary',
        'attendance',
        'leave',
      ];
      for (const perm of allPermissions) {
        const [mod] = perm.code.split(':');
        if (hrModules.includes(mod) && perm.code !== 'system:configure') {
          await sequelize.query(
            `INSERT INTO role_permissions (role_id, permission_id, created_at)
             VALUES (:roleId, :permissionId, NOW())
             ON CONFLICT DO NOTHING;`,
            { replacements: { roleId: hrAdminRole.id, permissionId: perm.id }, type: QueryTypes.RAW },
          );
        }
      }
    }

    // Employee gets self-service reading permissions
    if (employeeRole) {
      const empCodes = [
        'system:health',
        'calendar:read',
        'shifts:read',
        'attendance:self_read',
        'leave_types:read',
        'leave:self_read',
        'leave:self_create',
        'leave:self_cancel',
      ];
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

    // 5. Seed Default Designations Master
    console.log('Seeding default designations...');
    for (const d of DEFAULT_DESIGNATIONS) {
      await sequelize.query(
        `INSERT INTO designations (id, code, title, description, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :title, :description, true, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           updated_at = NOW();`,
        { replacements: d, type: QueryTypes.RAW },
      );
    }

    // 6. Seed Default Salary Components
    console.log('Seeding default salary components...');
    for (const sc of DEFAULT_SALARY_COMPONENTS) {
      await sequelize.query(
        `INSERT INTO salary_components (id, code, name, type, calculation_type, is_recurring, is_wps_basic, is_wps_housing, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :name, :type, :calculationType, :isRecurring, :isWpsBasic, :isWpsHousing, true, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           calculation_type = EXCLUDED.calculation_type,
           is_recurring = EXCLUDED.is_recurring,
           is_wps_basic = EXCLUDED.is_wps_basic,
           is_wps_housing = EXCLUDED.is_wps_housing,
           updated_at = NOW();`,
        { replacements: sc, type: QueryTypes.RAW },
      );
    }

    // 7. Seed Default Weekly Off (Sunday)
    console.log('Seeding default weekly off config...');
    const existingWeeklyOff = await sequelize.query<{ id: string }>(
      'SELECT id FROM weekly_off_configs WHERE is_default = true;',
      { type: QueryTypes.SELECT },
    );
    if (existingWeeklyOff.length === 0) {
      await sequelize.query(
        `INSERT INTO weekly_off_configs (id, name, days_of_week, effective_from, is_default, created_at, updated_at)
         VALUES (gen_random_uuid(), 'Standard Sunday Weekend', ARRAY[0], '2020-01-01', true, NOW(), NOW());`,
        { type: QueryTypes.RAW },
      );
    }

    // 8. Seed Default Leave Types
    console.log('Seeding default leave types...');
    const defaultLeaveTypes = [
      {
        code: 'ANNUAL',
        name: 'Annual Leave',
        description: 'Standard paid annual vacation leave',
        isPaid: true,
        defaultDaysPerYear: 30.0,
        requiresAttachment: false,
        deductWorkingDaysOnly: true,
        allowDuringProbation: false,
      },
      {
        code: 'SICK',
        name: 'Medical / Sick Leave',
        description: 'Leave for medical conditions and recovery with medical certificate',
        isPaid: true,
        defaultDaysPerYear: 15.0,
        requiresAttachment: true,
        deductWorkingDaysOnly: true,
        allowDuringProbation: true,
      },
      {
        code: 'UNPAID',
        name: 'Unpaid Leave',
        description: 'Approved leave without pay',
        isPaid: false,
        defaultDaysPerYear: 0.0,
        requiresAttachment: false,
        deductWorkingDaysOnly: true,
        allowDuringProbation: true,
      },
      {
        code: 'EMERGENCY',
        name: 'Emergency / Compassionate Leave',
        description: 'Short-term urgent or compassionate leave',
        isPaid: true,
        defaultDaysPerYear: 5.0,
        requiresAttachment: false,
        deductWorkingDaysOnly: true,
        allowDuringProbation: true,
      },
    ];

    for (const lt of defaultLeaveTypes) {
      await sequelize.query(
        `INSERT INTO leave_types (id, code, name, description, is_paid, default_days_per_year, requires_attachment, deduct_working_days_only, allow_during_probation, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), :code, :name, :description, :isPaid, :defaultDaysPerYear, :requiresAttachment, :deductWorkingDaysOnly, :allowDuringProbation, true, NOW(), NOW())
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_paid = EXCLUDED.is_paid,
           default_days_per_year = EXCLUDED.default_days_per_year,
           requires_attachment = EXCLUDED.requires_attachment,
           deduct_working_days_only = EXCLUDED.deduct_working_days_only,
           allow_during_probation = EXCLUDED.allow_during_probation,
           updated_at = NOW();`,
        { replacements: lt, type: QueryTypes.RAW },
      );
    }

    // NOTE: Public holidays are NOT seeded here. The public_holidays table is company-configured.

    console.log('=== Database Seeding Completed Successfully ===\n');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
