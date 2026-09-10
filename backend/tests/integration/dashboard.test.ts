import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { AuditLog } from '../../src/modules/auth/models/audit-log.model';

describe('Enterprise HRMS Dashboard Integration Tests', () => {
  const app = createApp();
  let adminToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Fetch or create an admin user for authentication
    let adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) {
      adminUser = await User.create({
        email: 'admin@blueroyal.com',
        passwordHash: 'dummy',
        firstName: 'System',
        lastName: 'Admin',
        isActive: true,
      });
    }

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // Seed a test audit log entry so recent activity has at least one event
    await AuditLog.create({
      actorId: adminUser.id,
      action: 'EMPLOYEE_CREATED',
      resourceType: 'Employee',
      resourceId: adminUser.id,
      newValues: { test: true },
      correlationId: 'test-cid-dashboard',
    });
  });

  it('1. GET /api/v1/dashboard/summary -> should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. GET /api/v1/dashboard/summary -> should return 200 with complete enterprise dashboard summary', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();

    // 1. Primary KPIs
    expect(data.kpis).toBeDefined();
    expect(typeof data.kpis.totalEmployees).toBe('number');
    expect(typeof data.kpis.activeEmployees).toBe('number');
    expect(typeof data.kpis.presentToday).toBe('number');
    expect(typeof data.kpis.onLeaveToday).toBe('number');
    expect(typeof data.kpis.pendingLeaves).toBe('number');
    expect(typeof data.kpis.newJoinersThisMonth).toBe('number');

    // 2. Attendance Overview
    expect(data.attendance).toBeDefined();
    expect(data.attendance.today).toBeDefined();
    expect(typeof data.attendance.today.present).toBe('number');
    expect(typeof data.attendance.today.absent).toBe('number');
    expect(typeof data.attendance.today.attendanceRate).toBe('number');
    expect(Array.isArray(data.attendance.trend)).toBe(true);

    // 3. Leave Overview
    expect(data.leave).toBeDefined();
    expect(typeof data.leave.pendingCount).toBe('number');
    expect(typeof data.leave.approvedCount).toBe('number');
    expect(typeof data.leave.totalDaysTaken).toBe('number');
    expect(Array.isArray(data.leave.byType)).toBe(true);

    // 4. Payroll Overview
    expect(data.payroll).toBeDefined();
    expect(typeof data.payroll.hasData).toBe('boolean');

    // 5. Workforce Distribution
    expect(data.workforce).toBeDefined();
    expect(Array.isArray(data.workforce.byDesignation)).toBe(true);
    expect(Array.isArray(data.workforce.byEmploymentType)).toBe(true);

    // 6. Action Required
    expect(Array.isArray(data.actionRequired)).toBe(true);

    // 7. Recent Activity
    expect(Array.isArray(data.recentActivity)).toBe(true);
    if (data.recentActivity.length > 0) {
      const firstActivity = data.recentActivity[0];
      expect(firstActivity.id).toBeDefined();
      expect(firstActivity.description).toBeDefined();
      expect(firstActivity.relativeTime).toBeDefined();
    }
  });
});
