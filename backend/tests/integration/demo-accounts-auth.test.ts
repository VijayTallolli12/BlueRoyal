import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { seedDemoUsers } from '../../../database/src/scripts/seed-demo-users';

describe('Demo Accounts Authentication & RBAC Verification', () => {
  const app = createApp();

  const superAdminPassword = 'SuperAdmin@2026!';
  const hrAdminPassword = 'HrAdmin@2026!';
  const employeePassword = 'Employee@2026!';

  beforeAll(async () => {
    await sequelize.authenticate();

    // Clear any test overrides to test default presentation credentials
    delete process.env.DEMO_SUPERADMIN_PASSWORD;
    delete process.env.DEMO_HRADMIN_PASSWORD;
    delete process.env.DEMO_EMPLOYEE_PASSWORD;

    // Run the idempotent seeder
    await seedDemoUsers();
  });

  describe('1. Super Admin Account (superadmin@blueroyal.com)', () => {
    let superAdminToken: string;

    it('should reject invalid password with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@blueroyal.com',
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should authenticate successfully and return super_admin role with full permissions', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@blueroyal.com',
          password: superAdminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('superadmin@blueroyal.com');
      expect(res.body.data.user.roles).toContain('super_admin');

      superAdminToken = res.body.data.accessToken;
    });

    it('should grant access to admin operational & attendance endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/periods')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('2. HR Admin Account (hradmin@blueroyal.com)', () => {
    let hrAdminToken: string;

    it('should authenticate successfully and return hr_admin role with operational permissions', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'hradmin@blueroyal.com',
          password: hrAdminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('hradmin@blueroyal.com');
      expect(res.body.data.user.roles).toContain('hr_admin');

      // Verify HR Admin permissions include attendance lifecycle
      const permissions = res.body.data.user.permissions;
      expect(permissions).toContain('attendance:read');
      expect(permissions).toContain('attendance:create');
      expect(permissions).toContain('attendance:submit');
      expect(permissions).toContain('attendance:approve');
      expect(permissions).toContain('attendance:lock');
      expect(permissions).toContain('attendance:unlock');

      hrAdminToken = res.body.data.accessToken;
    });

    it('should allow HR Admin to access attendance periods', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/periods')
        .set('Authorization', `Bearer ${hrAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('3. Employee Account (employee@blueroyal.com)', () => {
    let employeeToken: string;

    it('should authenticate successfully and return employee role with self-service permissions only', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'employee@blueroyal.com',
          password: employeePassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('employee@blueroyal.com');
      expect(res.body.data.user.roles).toContain('employee');
      expect(res.body.data.user.roles).not.toContain('hr_admin');
      expect(res.body.data.user.roles).not.toContain('super_admin');

      const permissions = res.body.data.user.permissions;
      expect(permissions).toContain('attendance:self_read');
      expect(permissions).not.toContain('attendance:submit');
      expect(permissions).not.toContain('attendance:approve');
      expect(permissions).not.toContain('attendance:lock');

      employeeToken = res.body.data.accessToken;
    });

    it('should allow employee to access my-attendance endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/my-attendance')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should STRICTLY FORBID employee from accessing admin attendance management routes (403 Forbidden)', async () => {
      // 1. Attempting to create an attendance period
      const createRes = await request(app)
        .post('/api/v1/attendance/periods')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ periodCode: '2026-12' });

      expect(createRes.status).toBe(403);
      expect(createRes.body.error.code).toBe('FORBIDDEN');

      // 2. Attempting to submit attendance period
      const submitRes = await request(app)
        .post('/api/v1/attendance/periods/00000000-0000-0000-0000-000000000000/submit')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(submitRes.status).toBe(403);
      expect(submitRes.body.error.code).toBe('FORBIDDEN');

      // 3. Attempting to access designation management
      const desRes = await request(app)
        .post('/api/v1/designations')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ code: 'HACK', title: 'Unauthorized' });

      expect(desRes.status).toBe(403);
      expect(desRes.body.error.code).toBe('FORBIDDEN');
    });
  });
});
