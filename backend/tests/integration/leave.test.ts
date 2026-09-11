import request from 'supertest';
import jwt from 'jsonwebtoken';
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
import { AuditLog } from '../../src/modules/auth/models/audit-log.model';
import { LeaveType } from '../../src/modules/leave/models/leave-type.model';
import { EmployeeLeaveBalance } from '../../src/modules/leave/models/employee-leave-balance.model';
import { LeaveRequest } from '../../src/modules/leave/models/leave-request.model';

describe('Phase 3 Leave Management & Employee Entitlements Integration Tests', () => {
  const app = createApp();
  let adminToken: string;
  let employeeUserToken: string;
  let testEmployeeId: string;
  let testAnnualLeaveTypeId: string;
  let testShiftId: string;
  const timestamp = Date.now();
  const testPeriodCode = '2026-10';
  const testYear = 2026;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Clean up any stale 2026-10 test period from prior failed runs
    const oldPeriod = await AttendancePeriod.findOne({ where: { periodCode: testPeriodCode } });
    if (oldPeriod) {
      const recs = await AttendanceRecord.findAll({
        where: { attendancePeriodId: oldPeriod.id },
        attributes: ['id'],
      });
      await AttendanceAuditLog.destroy({
        where: { attendanceRecordId: recs.map((r) => r.id) },
      });
      await AttendanceRecord.destroy({ where: { attendancePeriodId: oldPeriod.id } });
      await AttendancePeriod.destroy({ where: { id: oldPeriod.id } });
    }

    // 1. Admin Token (super_admin)
    const adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) throw new Error('Admin user not seeded');

    adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. Employee User & Role
    const empUser = await User.create({
      email: `emp_leave_${timestamp}@blueroyal.com`,
      passwordHash: 'hashedpwd',
      firstName: 'Leave',
      lastName: 'Applicant',
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

    // 3. Employee Master Record (Active full-time)
    const emp = await Employee.create({
      employeeCode: `EMP-LV-${timestamp}`,
      firstName: 'Leave',
      lastName: 'Applicant',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'Emirati',
      email: `emp_leave_${timestamp}@blueroyal.com`,
      phone: '+971501234567',
      dateOfJoining: '2025-01-01',
      employmentType: 'full_time',
      status: 'active',
      userId: empUser.id,
    });
    testEmployeeId = emp.id;

    // 4. Shift & Shift Assignment
    const shift = await Shift.create({
      code: `S-LV-${timestamp}`,
      name: 'Leave Test Standard Shift',
      startTime: '08:00:00',
      endTime: '17:00:00',
      workHours: 8.0,
      breakMinutes: 60,
      isActive: true,
    });
    testShiftId = shift.id;

    await EmployeeShiftAssignment.create({
      employeeId: testEmployeeId,
      shiftId: testShiftId,
      effectiveFrom: '2025-01-01',
      effectiveTo: null,
    });

    // 5. Get seeded ANNUAL leave type
    const annualType = await LeaveType.findOne({ where: { code: 'ANNUAL' } });
    if (!annualType) throw new Error('Seeded ANNUAL leave type missing');
    testAnnualLeaveTypeId = annualType.id;
  });

  afterAll(async () => {
    // Teardown test artifacts
    if (testEmployeeId) {
      await LeaveRequest.destroy({ where: { employeeId: testEmployeeId }, force: true });
      await EmployeeLeaveBalance.destroy({ where: { employeeId: testEmployeeId }, force: true });
      await AttendanceAuditLog.destroy({ where: { employeeId: testEmployeeId } });
      await AttendanceRecord.destroy({ where: { employeeId: testEmployeeId }, force: true });
      const p = await AttendancePeriod.findOne({ where: { periodCode: testPeriodCode } });
      if (p) {
        await AttendanceRecord.destroy({ where: { attendancePeriodId: p.id }, force: true });
        await AttendancePeriod.destroy({ where: { id: p.id }, force: true });
      }
      await EmployeeShiftAssignment.destroy({ where: { employeeId: testEmployeeId }, force: true });
      await Employee.destroy({ where: { id: testEmployeeId }, force: true });
    }
    if (testShiftId) {
      await Shift.destroy({ where: { id: testShiftId }, force: true });
    }
    await sequelize.close();
  });

  // 1. List Leave Types
  it('1. GET /leave/types -> Should list active leave types for authenticated users', async () => {
    const res = await request(app)
      .get('/api/v1/leave/types')
      .set('Authorization', `Bearer ${employeeUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((t: any) => t.code === 'ANNUAL')).toBe(true);
    expect(res.body.data.some((t: any) => t.code === 'SICK')).toBe(true);
  });

  // 2. Allocate Balance & RBAC check
  it('2. POST /leave/balances/allocate -> HR/Admin can allocate balance, Employee gets 403', async () => {
    // Employee attempt should be 403 Forbidden
    const forbiddenRes = await request(app)
      .post('/api/v1/leave/balances/allocate')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        employeeId: testEmployeeId,
        leaveTypeId: testAnnualLeaveTypeId,
        year: testYear,
        allocatedDays: 30.0,
      });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

    // Admin allocation succeeds
    const res = await request(app)
      .post('/api/v1/leave/balances/allocate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId: testEmployeeId,
        leaveTypeId: testAnnualLeaveTypeId,
        year: testYear,
        allocatedDays: 30.0,
        carriedForward: 2.0,
        notes: 'Initial 2026 allocation',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.data.allocatedDays)).toBe(30.0);
    expect(Number(res.body.data.carriedForward)).toBe(2.0);
  });

  let createdRequestId: string;

  // 3. Employee Submits Leave Request (Self-Service)
  it('3. POST /leave/my-leave -> Employee submits leave request, sets PENDING, increments pendingDays', async () => {
    // Dates: 2026-10-05 (Monday) to 2026-10-07 (Wednesday) = 3 working days
    const res = await request(app)
      .post('/api/v1/leave/my-leave')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        leaveTypeId: testAnnualLeaveTypeId,
        startDate: '2026-10-05',
        endDate: '2026-10-07',
        reason: 'Family holiday trip',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
    expect(res.body.data.requestNumber).toMatch(/^LR-202610-\d{4}$/);
    expect(Number(res.body.data.totalDays)).toBe(3.0);
    createdRequestId = res.body.data.id;

    // Check that pendingDays was updated in balance
    const balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId: testEmployeeId, leaveTypeId: testAnnualLeaveTypeId, year: testYear },
    });
    expect(Number(balance?.pendingDays)).toBe(3.0);
    expect(balance?.remainingDays).toBe(29.0); // 30 + 2 - 3 = 29
  });

  // 4. Overlap Prevention
  it('4. POST /leave/my-leave -> Overlapping leave request is strictly rejected with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/leave/my-leave')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        leaveTypeId: testAnnualLeaveTypeId,
        startDate: '2026-10-06', // Overlaps with 2026-10-05 -> 2026-10-07
        endDate: '2026-10-09',
        reason: 'Attempted overlapping request',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already covers date range');
  });

  // 5. Insufficient Balance Prevention
  it('5. POST /leave/my-leave -> Exceeding available leave balance is rejected with 422', async () => {
    const res = await request(app)
      .post('/api/v1/leave/my-leave')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        leaveTypeId: testAnnualLeaveTypeId,
        startDate: '2026-11-01',
        endDate: '2026-12-25', // ~40 working days, exceeds remaining 29
        reason: 'Too long vacation',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Insufficient leave balance');
  });

  // 6. Employee Self-Service Overview
  it('6. GET /leave/my-leave -> Employee retrieves own balances and requests', async () => {
    const res = await request(app)
      .get('/api/v1/leave/my-leave?year=2026')
      .set('Authorization', `Bearer ${employeeUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.employee.id).toBe(testEmployeeId);
    expect(Array.isArray(res.body.data.balances)).toBe(true);
    expect(Array.isArray(res.body.data.requests)).toBe(true);
    expect(res.body.data.requests.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.requests[0].id).toBe(createdRequestId);
  });

  // 7. Attendance Synchronization upon HR Approval
  it('7. POST /leave/requests/:id/approve -> HR approves request, synchronizes is_on_leave to attendance records', async () => {
    // 7a. First, create an attendance period covering 2026-10
    const periodRes = await request(app)
      .post('/api/v1/attendance/periods')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        periodCode: testPeriodCode,
        name: 'October 2026 Test Period',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      });
    expect(periodRes.status).toBe(201);

    // Verify initial attendance record on 2026-10-05 is absent and not on leave
    const initialRec = await AttendanceRecord.findOne({
      where: { employeeId: testEmployeeId, workDate: '2026-10-05' },
    });
    expect(initialRec).toBeDefined();
    expect(initialRec?.isOnLeave).toBe(false);

    // 7b. HR approves the leave request
    const approveRes = await request(app)
      .post(`/api/v1/leave/requests/${createdRequestId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.data.status).toBe('APPROVED');

    // 7c. Check employee leave balance updated (pending decreased, used increased)
    const balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId: testEmployeeId, leaveTypeId: testAnnualLeaveTypeId, year: testYear },
    });
    expect(Number(balance?.pendingDays)).toBe(0);
    expect(Number(balance?.usedDays)).toBe(3.0);
    expect(balance?.remainingDays).toBe(29.0);

    // 7d. Check Attendance Record on 2026-10-05 is now isOnLeave = true and isAbsent = false
    const updatedRec = await AttendanceRecord.findOne({
      where: { employeeId: testEmployeeId, workDate: '2026-10-05' },
    });
    expect(updatedRec?.isOnLeave).toBe(true);
    expect(updatedRec?.isAbsent).toBe(false);
    expect(Number(updatedRec?.regularHours)).toBe(0);
    expect(Number(updatedRec?.otHours)).toBe(0);

    // 7e. Check Attendance Audit Log created
    const attAudit = await AttendanceAuditLog.findOne({
      where: { attendanceRecordId: updatedRec!.id, fieldName: 'is_on_leave' },
    });
    expect(attAudit).toBeDefined();
    expect(attAudit?.newValue).toBe('true');

    // 7f. Check System Regulatory Audit Log created
    const sysAudit = await AuditLog.findOne({
      where: { resourceId: createdRequestId, action: 'LEAVE_REQUEST_APPROVED' },
    });
    expect(sysAudit).toBeDefined();
  }, 60000);

  // 8. Rejection Workflow
  it('8. POST /leave/requests/:id/reject -> HR rejects request with mandatory reason and restores pending balance', async () => {
    // 8a. Employee submits a new request
    const subRes = await request(app)
      .post('/api/v1/leave/my-leave')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        leaveTypeId: testAnnualLeaveTypeId,
        startDate: '2026-10-12',
        endDate: '2026-10-13',
        reason: 'Personal errands',
      });
    expect(subRes.status).toBe(201);
    const reqToRejectId = subRes.body.data.id;

    // Check balance pending days
    let balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId: testEmployeeId, leaveTypeId: testAnnualLeaveTypeId, year: testYear },
    });
    expect(Number(balance?.pendingDays)).toBe(2.0);

    // 8b. HR rejects without reason -> should fail validation (min 5 chars)
    const failRes = await request(app)
      .post(`/api/v1/leave/requests/${reqToRejectId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'No' });
    expect(failRes.status).toBe(422);

    // 8c. HR rejects with valid reason
    const rejectRes = await request(app)
      .post(`/api/v1/leave/requests/${reqToRejectId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ rejectionReason: 'High project workload on these dates' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');
    expect(rejectRes.body.data.rejectionReason).toBe('High project workload on these dates');

    // Check pending balance restored
    balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId: testEmployeeId, leaveTypeId: testAnnualLeaveTypeId, year: testYear },
    });
    expect(Number(balance?.pendingDays)).toBe(0);
  });

  // 9. Employee Cancellation of Pending Request
  it('9. POST /leave/my-leave/:id/cancel -> Employee can cancel own pending request', async () => {
    const subRes = await request(app)
      .post('/api/v1/leave/my-leave')
      .set('Authorization', `Bearer ${employeeUserToken}`)
      .send({
        leaveTypeId: testAnnualLeaveTypeId,
        startDate: '2026-10-19',
        endDate: '2026-10-19',
        reason: 'One day off',
      });
    expect(subRes.status).toBe(201);
    const reqToCancelId = subRes.body.data.id;

    const cancelRes = await request(app)
      .post(`/api/v1/leave/my-leave/${reqToCancelId}/cancel`)
      .set('Authorization', `Bearer ${employeeUserToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
  });

  // 10. Admin Revocation of Approved Request & Attendance Restoration
  it('10. POST /leave/requests/:id/cancel -> Admin can cancel approved request, restores used balance and resets attendance', async () => {
    const cancelRes = await request(app)
      .post(`/api/v1/leave/requests/${createdRequestId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancellationReason: 'Project emergency; employee recalled to work' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');

    // Balance: usedDays restored
    const balance = await EmployeeLeaveBalance.findOne({
      where: { employeeId: testEmployeeId, leaveTypeId: testAnnualLeaveTypeId, year: testYear },
    });
    expect(Number(balance?.usedDays)).toBe(0);

    // Attendance record: is_on_leave reset to false, isAbsent recomputed
    const rec = await AttendanceRecord.findOne({
      where: { employeeId: testEmployeeId, workDate: '2026-10-05' },
    });
    expect(rec?.isOnLeave).toBe(false);
    expect(rec?.isAbsent).toBe(true);
  });

  // 11. Security & RBAC: 401 & 403
  it('11. Security & RBAC -> Unauthorized requests get 401, Forbidden actions get 403', async () => {
    // No token -> 401
    const unauth = await request(app).get('/api/v1/leave/requests');
    expect(unauth.status).toBe(401);

    // Employee cannot approve requests -> 403
    const forbidden = await request(app)
      .post(`/api/v1/leave/requests/${createdRequestId}/approve`)
      .set('Authorization', `Bearer ${employeeUserToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });
});
