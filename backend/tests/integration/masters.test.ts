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
import { Employee } from '../../src/modules/masters/models/employee.model';
import { EmployeeAssignment } from '../../src/modules/masters/models/employee-assignment.model';
import { EmployeeHourlyRate } from '../../src/modules/masters/models/employee-hourly-rate.model';
import { SalaryComponent, EmployeeSalaryStructure } from '../../src/modules/masters/models/salary-component.model';
import { AuditLog } from '../../src/modules/auth/models/audit-log.model';
import { PublicHoliday } from '../../src/modules/masters/models/calendar.model';
import { Shift } from '../../src/modules/masters/models/shift.model';

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

    // Cleanup
    await Shift.destroy({ where: { id: res.body.data.id } });
  });

  // 4. Company Public Holidays
  it('POST /api/v1/calendar/holidays should add company-configured holiday', async () => {
    await PublicHoliday.destroy({ where: { holidayDate: '2026-11-15' } });

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

    // Cleanup
    await PublicHoliday.destroy({ where: { holidayDate: '2026-11-15' } });
  });

  // 5. Employee CRUD with Audit Log Verification
  it('POST /api/v1/employees should create employee and record EMPLOYEE_CREATED audit log', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeCode: `EMP-INT-${timestamp}`,
        firstName: 'Sarah',
        lastName: 'Connor',
        gender: 'female',
        dateOfBirth: '1992-05-14',
        nationality: 'British',
        dateOfJoining: '2026-02-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const employeeId = res.body.data.id;

    // Verify audit log
    const audit = await AuditLog.findOne({
      where: {
        action: 'EMPLOYEE_CREATED',
        resourceType: 'Employee',
        resourceId: employeeId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);

    // Cleanup
    await Employee.destroy({ where: { id: employeeId }, force: true });
  });

  // 6. Assignment CRUD with Audit Log Verification
  it('POST /api/v1/assignments should create assignment and record ASSIGNMENT_CREATED audit log', async () => {
    const timestamp = Date.now();

    // Create prerequisite records
    const emp = await Employee.create({
      employeeCode: `EMP-ASG-${timestamp}`,
      firstName: 'James',
      lastName: 'Bond',
      gender: 'male',
      dateOfBirth: '1988-01-01',
      nationality: 'British',
      dateOfJoining: '2026-01-01',
    });
    const des = await Designation.create({
      code: `DES-ASG-${timestamp}`,
      title: 'Field Agent',
    });
    const cli = await Client.create({
      code: `CLI-ASG-${timestamp}`,
      name: 'MI6 Holdings',
    });
    const prj = await Project.create({
      clientId: cli.id,
      code: `PRJ-ASG-${timestamp}`,
      name: 'Skyfall Operations',
    });

    const res = await request(app)
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: emp.id,
        clientId: cli.id,
        projectId: prj.id,
        designationId: des.id,
        effectiveFrom: '2026-03-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const assignmentId = res.body.data.id;

    // Verify audit log
    const audit = await AuditLog.findOne({
      where: {
        action: 'ASSIGNMENT_CREATED',
        resourceType: 'EmployeeAssignment',
        resourceId: assignmentId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);

    // Cleanup
    await EmployeeAssignment.destroy({ where: { id: assignmentId } });
    await Project.destroy({ where: { id: prj.id }, force: true });
    await Client.destroy({ where: { id: cli.id }, force: true });
    await Designation.destroy({ where: { id: des.id } });
    await Employee.destroy({ where: { id: emp.id }, force: true });
  });

  // 7. Rate Configuration with Audit Log Verification
  it('POST /api/v1/rates/employee-rates should record EMPLOYEE_HOURLY_RATE_CONFIGURED audit log', async () => {
    const timestamp = Date.now();
    const emp = await Employee.create({
      employeeCode: `EMP-RAT-${timestamp}`,
      firstName: 'Rate',
      lastName: 'Tester',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'Indian',
      dateOfJoining: '2026-01-01',
    });

    const res = await request(app)
      .post('/api/v1/rates/employee-rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: emp.id,
        normalHourlyRate: 25.0,
        otHourlyRate: 37.5,
        effectiveFrom: '2026-01-01',
        changeReason: 'Initial rate setup',
      });

    expect(res.status).toBe(201);
    const rateId = res.body.data.id;

    // Verify audit log
    const audit = await AuditLog.findOne({
      where: {
        action: 'EMPLOYEE_HOURLY_RATE_CONFIGURED',
        resourceType: 'EmployeeHourlyRate',
        resourceId: rateId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(adminUserId);

    // Cleanup
    await EmployeeHourlyRate.destroy({ where: { id: rateId } });
    await Employee.destroy({ where: { id: emp.id }, force: true });
  });

  // 8. Salary Component & Structure with Audit Log Verification
  it('POST /api/v1/salary/components and structures should record audit logs', async () => {
    const timestamp = Date.now();

    // Create custom allowance component
    const compRes = await request(app)
      .post('/api/v1/salary/components')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `ALLOW-${timestamp}`,
        name: 'Site Allowance',
        type: 'earning',
        calculationType: 'fixed',
      });

    expect(compRes.status).toBe(201);
    const compId = compRes.body.data.id;

    // Verify component audit log
    const compAudit = await AuditLog.findOne({
      where: {
        action: 'SALARY_COMPONENT_CREATED',
        resourceType: 'SalaryComponent',
        resourceId: compId,
      },
    });
    expect(compAudit).not.toBeNull();

    // Create employee
    const emp = await Employee.create({
      employeeCode: `EMP-SAL-${timestamp}`,
      firstName: 'Salary',
      lastName: 'Tester',
      gender: 'other',
      dateOfBirth: '1995-01-01',
      nationality: 'Filipino',
      dateOfJoining: '2026-01-01',
    });

    // Create structure
    const structRes = await request(app)
      .post('/api/v1/salary/structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: emp.id,
        componentId: compId,
        amountOrPercentage: 500.0,
        effectiveFrom: '2026-01-01',
      });

    expect(structRes.status).toBe(201);
    const structId = structRes.body.data.id;

    // Verify structure audit log
    const structAudit = await AuditLog.findOne({
      where: {
        action: 'SALARY_STRUCTURE_CONFIGURED',
        resourceType: 'EmployeeSalaryStructure',
        resourceId: structId,
      },
    });
    expect(structAudit).not.toBeNull();

    // Cleanup
    await EmployeeSalaryStructure.destroy({ where: { id: structId } });
    await Employee.destroy({ where: { id: emp.id }, force: true });
    await SalaryComponent.destroy({ where: { id: compId } });
  });
});
