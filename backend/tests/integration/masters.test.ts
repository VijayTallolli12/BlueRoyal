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

  it('POST and PUT /api/v1/clients and /api/v1/projects should support email/phoneNumber/location aliases and preserve status', async () => {
    const timestamp = Date.now();

    // 1. Create client with email and phoneNumber
    const clientRes = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `CLI-ALIAS-${timestamp}`,
        name: 'Alias Test Client',
        contactPerson: 'Alice Wonder',
        email: 'alice@aliastest.com',
        phoneNumber: '+971 50 999 8888',
      });

    expect(clientRes.status).toBe(201);
    expect(clientRes.body.data.contactEmail).toBe('alice@aliastest.com');
    expect(clientRes.body.data.contactPhone).toBe('+971 50 999 8888');
    expect(clientRes.body.data.email).toBe('alice@aliastest.com');
    expect(clientRes.body.data.phoneNumber).toBe('+971 50 999 8888');
    expect(clientRes.body.data.isActive).toBe(true);
    const clientId = clientRes.body.data.id;

    // 2. Update client with new email, preserving isActive
    const clientUpdateRes = await request(app)
      .put(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Alias Client',
        email: 'alice.updated@aliastest.com',
      });

    expect(clientUpdateRes.status).toBe(200);
    expect(clientUpdateRes.body.data.name).toBe('Updated Alias Client');
    expect(clientUpdateRes.body.data.contactEmail).toBe('alice.updated@aliastest.com');
    expect(clientUpdateRes.body.data.email).toBe('alice.updated@aliastest.com');
    expect(clientUpdateRes.body.data.contactPhone).toBe('+971 50 999 8888');
    expect(clientUpdateRes.body.data.isActive).toBe(true);

    // 3. Create project with location alias
    const projRes = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        code: `PRJ-ALIAS-${timestamp}`,
        name: 'Alias Project Alpha',
        location: 'Downtown Dubai Boulevard',
      });

    expect(projRes.status).toBe(201);
    expect(projRes.body.data.siteLocation).toBe('Downtown Dubai Boulevard');
    expect(projRes.body.data.location).toBe('Downtown Dubai Boulevard');
    expect(projRes.body.data.status).toBe('active');
    const projectId = projRes.body.data.id;

    // 4. Update project with new location alias, preserving status
    const projUpdateRes = await request(app)
      .put(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Project Alpha',
        location: 'Business Bay Creek',
      });

    expect(projUpdateRes.status).toBe(200);
    expect(projUpdateRes.body.data.name).toBe('Updated Project Alpha');
    expect(projUpdateRes.body.data.siteLocation).toBe('Business Bay Creek');
    expect(projUpdateRes.body.data.location).toBe('Business Bay Creek');
    expect(projUpdateRes.body.data.status).toBe('active');

    // Cleanup
    await Project.destroy({ where: { id: projectId }, force: true });
    await Client.destroy({ where: { id: clientId }, force: true });
  });

  // 3. Shifts (Authoritative Work Hours, Overnight Detection, Same Time Validation, and Update)
  it('POST /api/v1/shifts should authoritatively calculate workHours and support overnight shifts and PUT updates', async () => {
    const timestamp = Date.now();

    // 1. Same start and end time validation
    const sameTimeRes = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `SH-SAME-${timestamp}`,
        name: 'Invalid Same Time Shift',
        startTime: '08:00',
        endTime: '08:00',
        breakMinutes: 0,
      });
    expect(sameTimeRes.status).toBe(400);
    expect(sameTimeRes.body.error.message).toContain('Start time and end time cannot be the same');

    // 2. Break greater than duration validation
    const invalidBreakRes = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `SH-BRK-${timestamp}`,
        name: 'Invalid Break Shift',
        startTime: '08:00',
        endTime: '12:00',
        breakMinutes: 300,
      });
    expect(invalidBreakRes.status).toBe(400);
    expect(invalidBreakRes.body.error.message).toContain('Break time cannot be greater than the shift duration');

    // 3. Normal Day Shift (client sends tampered workHours: 99.0, backend authoritatively calculates 8.00)
    const dayRes = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `SH-DAY-${timestamp}`,
        name: 'Standard Morning Shift',
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
        workHours: 99.0, // Should be ignored by authoritative backend calculation
      });

    expect(dayRes.status).toBe(201);
    expect(dayRes.body.data.code).toBe(`SH-DAY-${timestamp}`);
    expect(Number(dayRes.body.data.workHours)).toBe(8.0);
    expect(dayRes.body.data.isNightShift).toBe(false);
    const shiftId = dayRes.body.data.id;

    // 4. Update Shift (PUT /shifts/:id to 08:30 to 17:30 with 30m break -> 8.50 hrs)
    const updateRes = await request(app)
      .put(`/api/v1/shifts/${shiftId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        startTime: '08:30',
        endTime: '17:30',
        breakMinutes: 30,
      });

    expect(updateRes.status).toBe(200);
    expect(Number(updateRes.body.data.workHours)).toBe(8.5);
    expect(updateRes.body.data.isNightShift).toBe(false);

    // 5. Overnight Shift (22:00 to 06:00 with 60m break -> duration 8 hrs - 1 hr break = 7.00 hrs, isNightShift: true)
    const nightRes = await request(app)
      .post('/api/v1/shifts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `SH-NIGHT-${timestamp}`,
        name: 'Night Operations Shift',
        startTime: '22:00',
        endTime: '06:00',
        breakMinutes: 60,
      });

    expect(nightRes.status).toBe(201);
    expect(Number(nightRes.body.data.workHours)).toBe(7.0);
    expect(nightRes.body.data.isNightShift).toBe(true);

    // Cleanup
    await Shift.destroy({ where: { id: [shiftId, nightRes.body.data.id] } });
  });

  // 4. Company Holidays (Create & Update)
  it('POST and PUT /api/v1/calendar/holidays should create and update holiday', async () => {
    await PublicHoliday.destroy({ where: { holidayDate: '2026-11-15' } });
    await PublicHoliday.destroy({ where: { holidayDate: '2026-11-16' } });

    const res = await request(app)
      .post('/api/v1/calendar/holidays')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Company Founder Day',
        holidayDate: '2026-11-15',
        description: 'Annual corporate celebration',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.holidayDate).toBe('2026-11-15');
    expect(res.body.data.calendarYear).toBe(2026);
    const holidayId = res.body.data.id;

    // Update Holiday
    const updateRes = await request(app)
      .put(`/api/v1/calendar/holidays/${holidayId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Founder Day',
        holidayDate: '2026-11-16',
        description: 'Updated celebration description',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Founder Day');
    expect(updateRes.body.data.holidayDate).toBe('2026-11-16');
    expect(updateRes.body.data.calendarYear).toBe(2026);

    // Cleanup
    await PublicHoliday.destroy({ where: { id: holidayId } });
  });

  // 5. Employee CRUD with Audit Log Verification & Mandatory Document Validation
  it('POST /api/v1/employees should reject creation when mandatory Passport and Visa are missing', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeCode: `EMP-INT-FAIL-${timestamp}`,
        firstName: 'Sarah',
        lastName: 'Connor',
        email: `sarah.${timestamp}@example.com`,
        gender: 'female',
        dateOfBirth: '1992-05-14',
        nationality: 'British',
        dateOfJoining: '2026-02-01',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Passport document is mandatory');
  });

  it('POST /api/v1/employees should create employee with mandatory Passport/Visa and record EMPLOYEE_CREATED audit log', async () => {
    const timestamp = Date.now();
    const res = await request(app)
      .post('/api/v1/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('employeeCode', `EMP-INT-${timestamp}`)
      .field('firstName', 'Sarah')
      .field('lastName', 'Connor')
      .field('email', `sarah.connor.${timestamp}@example.com`)
      .field('gender', 'female')
      .field('dateOfBirth', '1992-05-14')
      .field('country', 'United Kingdom')
      .field('nationality', 'British')
      .field('dateOfJoining', '2026-02-01')
      .attach('passport', Buffer.from('%PDF-1.4 sample passport content'), 'passport.pdf')
      .attach('visa', Buffer.from('%PDF-1.4 sample visa content'), 'visa.pdf');

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

    // Verify GET by ID loads documents
    const getRes = await request(app)
      .get(`/api/v1/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.documents).toBeDefined();
    expect(getRes.body.data.documents.length).toBe(2);

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
