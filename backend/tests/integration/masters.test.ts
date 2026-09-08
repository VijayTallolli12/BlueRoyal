import request from 'supertest';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { Role } from '../../src/modules/auth/models/role.model';
import { Designation } from '../../src/modules/masters/models/designation.model';
import { Client } from '../../src/modules/masters/models/client.model';
import { Project } from '../../src/modules/masters/models/project.model';

describe('Phase 1 Masters CRUD Integration Test Suite', () => {
  const app = createApp();
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Find admin user
    const adminUser = await User.findOne({
      where: { email: 'admin@blueroyal.com' },
      include: [{ model: Role, as: 'roles' }],
    });

    if (!adminUser) {
      throw new Error('Admin user not seeded');
    }
    adminUserId = adminUser.id;

    // Generate valid admin bearer token
    adminToken = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        roles: ['super_admin'],
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );
  });

  // 1. Designation CRUD
  it('POST /api/v1/designations should create new designation with 201', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/v1/designations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `DES-TEST-${timestamp}`,
        title: 'Senior QA Engineer',
        description: 'Test designation',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe(`DES-TEST-${timestamp}`);

    // Cleanup
    await Designation.destroy({ where: { id: res.body.data.id } });
  });

  it('GET /api/v1/designations should reject unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/designations');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 2. Client & Project CRUD
  it('POST /api/v1/clients and POST /api/v1/projects should succeed with relational foreign keys', async () => {
    const timestamp = Date.now();

    // Create client
    const clientRes = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `CLI-INT-${timestamp}`,
        name: 'Integration Client Corp',
        contactPerson: 'John Smith',
      });

    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.data.id;

    // Create project under client
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        code: `PRJ-INT-${timestamp}`,
        name: 'Tower Project Alpha',
        siteLocation: 'Dubai Marina',
      });

    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id;

    // Verify GET /api/v1/projects?clientId=:id
    const listRes = await request(app)
      .get(`/api/v1/projects?clientId=${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    await Project.destroy({ where: { id: projectId }, force: true });
    await Client.destroy({ where: { id: clientId }, force: true });
  });

  // 3. Shifts
  it('POST /api/v1/shifts should register shift timings with 201', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `SH-TEST-${timestamp}`,
        name: 'Standard Morning Shift',
        startTime: '08:00:00',
        endTime: '17:00:00',
        breakMinutes: 60,
        workHours: 8.0,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe(`SH-TEST-${timestamp}`);
  });

  // 4. Company Public Holidays
  it('POST /api/v1/calendar/holidays should add company-configured holiday', async () => {
    const res = await request(app)
      .post('/api/v1/calendar/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        calendarYear: 2026,
        name: 'Company Founder Day',
        holidayDate: '2026-11-15',
        description: 'Annual corporate celebration',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.holidayDate).toBe('2026-11-15');
  });
});
