import request from 'supertest';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { Role } from '../../src/modules/auth/models/role.model';
import { UserRole } from '../../src/modules/auth/models/user-role.model';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { Shift } from '../../src/modules/masters/models/shift.model';
import { EmployeeShiftAssignment } from '../../src/modules/masters/models/employee-shift-assignment.model';
import { AttendancePeriod } from '../../src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from '../../src/modules/attendance/models/attendance-record.model';
import { AttendanceAuditLog } from '../../src/modules/attendance/models/attendance-audit-log.model';

describe('Phase 2 Attendance & Overtime Engine Integration Tests', () => {
  const app = createApp();
  let adminToken: string;
  let employeeUserToken: string;
  let testEmployeeId: string;
  let testShiftId: string;
  const timestamp = Date.now();
  const testPeriodCode = `20${(timestamp % 90 + 10)}-05`; // e.g. 2026-05

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Resolve seeded admin user
    const adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) throw new Error('Admin user not seeded');

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. Create an Employee user and profile
    const empUser = await User.create({
      email: `emp_att_${timestamp}@blueroyal.com`,
      passwordHash: 'dummy',
      firstName: 'Attendance',
      lastName: 'Worker',
      isActive: true,
    });

    const empRole = await Role.findOne({ where: { name: 'employee' } });
    if (empRole) {
      await UserRole.create({ userId: empUser.id, roleId: empRole.id });
    }

    employeeUserToken = jwt.sign(
      { userId: empUser.id, email: empUser.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    const emp = await Employee.create({
      employeeCode: `ATT-${timestamp}`,
      userId: empUser.id,
      firstName: 'Attendance',
      lastName: 'Worker',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'Emirati',
      dateOfJoining: `${testPeriodCode}-01`,
      employmentType: 'full_time',
      status: 'active',
    });
    testEmployeeId = emp.id;

    // 3. Create Shift
    const shift = await Shift.create({
      code: `SH-${timestamp}`,
      name: 'Standard 8h Shift',
      startTime: '08:00:00',
      endTime: '17:00:00',
      breakMinutes: 60,
      workHours: 8.0,
      isActive: true,
    });
    testShiftId = shift.id;
  });

  afterAll(async () => {
    // Cleanup records created during test
    const period = await AttendancePeriod.findOne({ where: { periodCode: testPeriodCode } });
    if (period) {
      await AttendanceAuditLog.destroy({
        where: {
          attendanceRecordId: (
            await AttendanceRecord.findAll({
              where: { attendancePeriodId: period.id },
              attributes: ['id'],
            })
          ).map((r) => r.id),
        },
      });
      await AttendanceRecord.destroy({ where: { attendancePeriodId: period.id } });
      await AttendancePeriod.destroy({ where: { id: period.id } });
    }
  });

  let createdPeriodId: string;

  it('1. POST /attendance/periods -> should create a new monthly period in DRAFT and auto-generate records', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodCode: testPeriodCode,
        name: `May 20${timestamp % 90 + 10}`,
        startDate: `${testPeriodCode}-01`,
        endDate: `${testPeriodCode}-31`,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.periodCode).toBe(testPeriodCode);

    createdPeriodId = res.body.data.id;

    // Verify auto-generated records exist
    const count = await AttendanceRecord.count({
      where: { attendancePeriodId: createdPeriodId, employeeId: testEmployeeId },
    });
    expect(count).toBe(31);
  });

  it('2. GET /attendance/periods/:id/grid -> should return grid data, dates, and summary cards', async () => {
    const res = await request(app)
      .get(`/api/v1/attendance/periods/${createdPeriodId}/grid`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.period.status).toBe('draft');
    expect(res.body.data.dates.length).toBe(31);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.rows.length).toBeGreaterThan(0);
  });

  it('3. POST /attendance/periods/:id/submit -> should BLOCK submission if any unresolved anomaly exists', async () => {
    // Since employee has no shift assigned yet, regular workdays have MISSING_SHIFT_ASSIGNMENT anomaly
    const res = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('unresolved anomalies');
  });

  it('4. Resolve shift anomaly: Assign shift, recalculate via batch update, and verify anomaly is cleared', async () => {
    // 1. Create shift assignment for the employee
    await EmployeeShiftAssignment.create({
      employeeId: testEmployeeId,
      shiftId: testShiftId,
      effectiveFrom: `${testPeriodCode}-01`,
      effectiveTo: null,
    });

    // 2. Fetch a record to update
    const record = await AttendanceRecord.findOne({
      where: {
        attendancePeriodId: createdPeriodId,
        employeeId: testEmployeeId,
        workDate: `${testPeriodCode}-05`, // Tuesday
      },
    });
    expect(record).not.toBeNull();

    // Link the shift to the record
    await record!.update({ shiftId: testShiftId });

    // 3. Batch update with 10 actual hours (8 regular, 2 OT)
    const updateRes = await request(app)
      .put(`/api/v1/attendance/periods/${createdPeriodId}/records`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        records: [
          {
            recordId: record!.id,
            actualHours: 10.0,
            changeReason: 'Assigned shift and recorded 10h workday',
          },
        ],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.updatedCount).toBe(1);

    // Verify recalculation on record
    await record!.reload();
    expect(Number(record!.actualHours)).toBe(10.0);
    expect(Number(record!.regularHours)).toBe(8.0);
    expect(Number(record!.otHours)).toBe(2.0);
    expect(record!.hasAnomaly).toBe(false);

    // Verify cell-level audit log exists
    const auditRes = await request(app)
      .get(`/api/v1/attendance/records/${record!.id}/audit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    expect(auditRes.body.data[0].fieldName).toBe('actual_hours');
    expect(auditRes.body.data[0].newValue).toBe('10.00');
  });

  it('5. Resolve all anomalies and verify SUBMIT -> APPROVE -> LOCK lifecycle', async () => {
    // Clear any remaining anomalies for the test period
    await AttendanceRecord.update(
      { shiftId: testShiftId, hasAnomaly: false, anomalyReason: null },
      { where: { attendancePeriodId: createdPeriodId } },
    );

    // Submit Period
    const submitRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.status).toBe('submitted');

    // Approve Period
    const approveRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    // Lock Period
    const lockRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/lock`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.data.status).toBe('locked');
  });

  it('6. LOCKED Period enforcement: Writes must be strictly rejected', async () => {
    const record = await AttendanceRecord.findOne({
      where: { attendancePeriodId: createdPeriodId, employeeId: testEmployeeId },
    });

    const editRes = await request(app)
      .put(`/api/v1/attendance/periods/${createdPeriodId}/records`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        records: [
          {
            recordId: record!.id,
            actualHours: 8.0,
            changeReason: 'Attempted edit on locked period',
          },
        ],
      });

    expect(editRes.status).toBe(400);
    expect(editRes.body.error.message).toContain('locked');
  });

  it('7. Controlled Unlock: Requires >= 15 chars reason and reverts status to DRAFT', async () => {
    // Short reason fails validation (422)
    const shortRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Too short' });

    expect(shortRes.status).toBe(422);

    // Valid >= 15 chars justification succeeds
    const unlockRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Correction required due to late site overtime timesheet submission' });

    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body.data.status).toBe('draft');
    expect(unlockRes.body.data.unlockReason).toContain('Correction required');
  });

  it('8. Excel Template Download & Import Pipeline', async () => {
    // Template download
    const templateRes = await request(app)
      .get(`/api/v1/attendance/periods/${createdPeriodId}/template`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(templateRes.status).toBe(200);
    expect(templateRes.header['content-type']).toContain('vnd.openxmlformats-officedocument');

    // Create a mock Excel sheet for import
    const wb = XLSX.utils.book_new();
    const wsData = [
      {
        'Employee Code': `ATT-${timestamp}`,
        'Employee Name': 'Attendance Worker',
        'Work Date (YYYY-MM-DD)': `${testPeriodCode}-06`,
        'Actual Hours': 9.0,
        'On Leave (Y/N)': 'N',
        Remarks: 'Imported overtime',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Dry-run import
    const dryRunRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/import?dryRun=true`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'test.xlsx');

    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.data.dryRun).toBe(true);
    expect(dryRunRes.body.data.errorCount).toBe(0);

    // Actual import execution
    const importRes = await request(app)
      .post(`/api/v1/attendance/periods/${createdPeriodId}/import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, 'test.xlsx');

    expect(importRes.status).toBe(200);
    expect(importRes.body.data.success).toBe(true);
    expect(importRes.body.data.validRows).toBe(1);

    // Verify updated record
    const updatedRec = await AttendanceRecord.findOne({
      where: {
        attendancePeriodId: createdPeriodId,
        employeeId: testEmployeeId,
        workDate: `${testPeriodCode}-06`,
      },
    });
    expect(Number(updatedRec!.actualHours)).toBe(9.0);
    expect(updatedRec!.remarks).toBe('Imported overtime');
  });

  it('9. GET /attendance/my-attendance -> Employee self-view', async () => {
    const res = await request(app)
      .get(`/api/v1/attendance/my-attendance?periodCode=${testPeriodCode}`)
      .set('Authorization', `Bearer ${employeeUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.period).toBeDefined();
    expect(res.body.data.records.length).toBe(31);
    expect(res.body.data.summary.totalDays).toBe(31);
  });
});
