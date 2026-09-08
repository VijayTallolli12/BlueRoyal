import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app';
import { sequelize } from '../../src/core/database/sequelize';
import { env } from '../../src/config/env';
import { User } from '../../src/modules/auth/models/user.model';
import { Role } from '../../src/modules/auth/models/role.model';
import { UserRole } from '../../src/modules/auth/models/user-role.model';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { EmployeeHourlyRate } from '../../src/modules/masters/models/employee-hourly-rate.model';
import { SalaryComponent, EmployeeSalaryStructure } from '../../src/modules/masters/models/salary-component.model';
import { AttendancePeriod } from '../../src/modules/attendance/models/attendance-period.model';
import { AttendanceRecord } from '../../src/modules/attendance/models/attendance-record.model';
import { PayrollPeriod } from '../../src/modules/payroll/models/payroll-period.model';
import { PayrollItem } from '../../src/modules/payroll/models/payroll-item.model';
import { PayrollItemLine } from '../../src/modules/payroll/models/payroll-item-line.model';

describe('Phase 4 Payroll Processing & Financial Traceability Integration Tests', () => {
  const app = createApp();
  let superAdminToken: string;
  let hrAdminToken: string;
  let employeeToken: string;

  let hourlyEmployee: Employee;
  let salariedEmployee: Employee;
  let attendancePeriodLocked: AttendancePeriod;
  let attendancePeriodDraft: AttendancePeriod;
  let basicSalaryComponent: SalaryComponent;

  const timestamp = Date.now();
  const testYear = 2030 + (timestamp % 10);
  const testPeriodCode = `${testYear}-11`;
  const draftPeriodCode = `${testYear}-12`;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Clean up stale periods if any
    for (const pCode of [testPeriodCode, draftPeriodCode]) {
      const existing = await AttendancePeriod.findOne({ where: { periodCode: pCode } });
      if (existing) {
        const pPeriods = await PayrollPeriod.findAll({ where: { attendancePeriodId: existing.id } });
        for (const pp of pPeriods) {
          const items = await PayrollItem.findAll({ where: { payrollPeriodId: pp.id } });
          await PayrollItemLine.destroy({ where: { payrollItemId: items.map((i) => i.id) } });
          await PayrollItem.destroy({ where: { payrollPeriodId: pp.id } });
          await pp.destroy();
        }
        await AttendanceRecord.destroy({ where: { attendancePeriodId: existing.id } });
        await existing.destroy();
      }
    }

    // 1. Tokens
    const adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) throw new Error('Admin user not seeded');

    superAdminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // Create HR Admin user
    const hrUser = await User.create({
      email: `hr_payroll_${timestamp}@blueroyal.com`,
      passwordHash: 'dummy',
      firstName: 'HR',
      lastName: 'PayrollAdmin',
      isActive: true,
    });
    const hrRole = await Role.findOne({ where: { name: 'hr_admin' } });
    if (hrRole) {
      await UserRole.create({ userId: hrUser.id, roleId: hrRole.id });
    }
    hrAdminToken = jwt.sign(
      { userId: hrUser.id, email: hrUser.email, roles: ['hr_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // Create Employee user
    const empUser = await User.create({
      email: `emp_payroll_${timestamp}@blueroyal.com`,
      passwordHash: 'dummy',
      firstName: 'Test',
      lastName: 'PayrollEmp',
      isActive: true,
    });
    const empRole = await Role.findOne({ where: { name: 'employee' } });
    if (empRole) {
      await UserRole.create({ userId: empUser.id, roleId: empRole.id });
    }
    employeeToken = jwt.sign(
      { userId: empUser.id, email: empUser.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. Create Employees
    hourlyEmployee = await Employee.create({
      userId: empUser.id,
      employeeCode: `HRLY-${timestamp.toString().slice(-4)}`,
      firstName: 'Hourly',
      lastName: 'Worker',
      gender: 'male',
      dateOfBirth: '1992-05-10',
      nationality: 'Indian',
      email: `emp_payroll_${timestamp}@blueroyal.com`,
      phone: '+971501112233',
      dateOfJoining: '2026-01-01',
      employmentType: 'full_time',
      remunerationBasis: 'hourly',
      status: 'active',
    });

    salariedEmployee = await Employee.create({
      employeeCode: `SAL-${timestamp.toString().slice(-4)}`,
      firstName: 'Salaried',
      lastName: 'Executive',
      gender: 'female',
      dateOfBirth: '1990-08-15',
      nationality: 'Emirati',
      email: `sal_payroll_${timestamp}@blueroyal.com`,
      phone: '+971502223344',
      dateOfJoining: '2026-01-01',
      employmentType: 'full_time',
      remunerationBasis: 'salaried',
      status: 'active',
    });

    // 3. Configure Hourly Rate for hourlyEmployee
    await EmployeeHourlyRate.create({
      employeeId: hourlyEmployee.id,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      normalHourlyRate: 20.0,
      otHourlyRate: 25.0,
    });

    // 4. Configure Salary Component and Structure for salariedEmployee
    basicSalaryComponent = await SalaryComponent.create({
      name: `Basic Salary ${timestamp}`,
      code: `BASIC_${timestamp.toString().slice(-4)}`,
      type: 'earning',
      calculationType: 'fixed',
      isTaxable: false,
      isActive: true,
    });

    await EmployeeSalaryStructure.create({
      employeeId: salariedEmployee.id,
      componentId: basicSalaryComponent.id,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      amountOrPercentage: 8000.0,
    });

    // 5. Create Attendance Periods
    // A) Locked Attendance Period
    attendancePeriodLocked = await AttendancePeriod.create({
      periodCode: testPeriodCode,
      name: `Attendance Period ${testPeriodCode}`,
      startDate: `${testYear}-11-01`,
      endDate: `${testYear}-11-30`,
      status: 'locked',
      lockedAt: new Date(),
      lockedBy: adminUser.id,
    });

    // Attendance records for hourly employee: 20 days x 8h reg + 2h OT = 160 reg, 40 OT
    for (let day = 1; day <= 20; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      await AttendanceRecord.create({
        attendancePeriodId: attendancePeriodLocked.id,
        employeeId: hourlyEmployee.id,
        workDate: `${testYear}-11-${dayStr}`,
        dayType: 'regular_workday',
        actualHours: 10.0,
        regularHours: 8.0,
        otHours: 2.0,
        isAbsent: false,
        hasAnomaly: false,
      });
    }

    // Attendance records for salaried employee: 20 days regular workday
    for (let day = 1; day <= 20; day++) {
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      await AttendanceRecord.create({
        attendancePeriodId: attendancePeriodLocked.id,
        employeeId: salariedEmployee.id,
        workDate: `${testYear}-11-${dayStr}`,
        dayType: 'regular_workday',
        actualHours: 8.0,
        regularHours: 8.0,
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: false,
      });
    }

    // B) Draft Attendance Period (to test locked attendance gate)
    attendancePeriodDraft = await AttendancePeriod.create({
      periodCode: draftPeriodCode,
      name: `Attendance Period ${draftPeriodCode}`,
      startDate: `${testYear}-12-01`,
      endDate: `${testYear}-12-31`,
      status: 'draft',
    });
    await AttendanceRecord.create({
      attendancePeriodId: attendancePeriodDraft.id,
      employeeId: hourlyEmployee.id,
      workDate: `${testYear}-12-01`,
      dayType: 'regular_workday',
      actualHours: 8.0,
      regularHours: 8.0,
      otHours: 0.0,
      isAbsent: false,
      hasAnomaly: false,
    });
  });

  afterAll(async () => {
    // Clean up created entities
    if (attendancePeriodLocked) {
      const pPeriods = await PayrollPeriod.findAll({
        where: { attendancePeriodId: attendancePeriodLocked.id },
      });
      for (const pp of pPeriods) {
        const items = await PayrollItem.findAll({ where: { payrollPeriodId: pp.id } });
        await PayrollItemLine.destroy({ where: { payrollItemId: items.map((i) => i.id) } });
        await PayrollItem.destroy({ where: { payrollPeriodId: pp.id } });
        await pp.destroy();
      }
      await AttendanceRecord.destroy({ where: { attendancePeriodId: attendancePeriodLocked.id } });
      await attendancePeriodLocked.destroy();
    }

    if (attendancePeriodDraft) {
      const pPeriods = await PayrollPeriod.findAll({
        where: { attendancePeriodId: attendancePeriodDraft.id },
      });
      for (const pp of pPeriods) {
        await pp.destroy();
      }
      await AttendanceRecord.destroy({ where: { attendancePeriodId: attendancePeriodDraft.id } });
      await attendancePeriodDraft.destroy();
    }
  });

  let createdPayrollPeriodId: string;
  let hourlyItemId: string;
  let testAdjustmentLineId: string;

  it('1. POST /api/v1/payroll/periods -> Should create a new payroll period in DRAFT status', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/periods')
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        attendancePeriodId: attendancePeriodLocked.id,
        notes: 'November 2026 Regular Payroll Run',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.periodCode).toBe(testPeriodCode);
    expect(res.body.data.totalGrossPay).toBe(0);
    expect(res.body.data.totalNetPay).toBe(0);

    createdPayrollPeriodId = res.body.data.id;
  });

  it('2. POST /api/v1/payroll/periods/:id/calculate -> Locked Attendance Gate: should reject calculation if attendance is not locked', async () => {
    // Create payroll period linked to draft attendance
    const draftPayrollPeriod = await PayrollPeriod.create({
      periodCode: `${draftPeriodCode}-TEST`,
      name: `Payroll Period ${draftPeriodCode}-TEST`,
      startDate: `${testYear}-12-01`,
      endDate: `${testYear}-12-31`,
      attendancePeriodId: attendancePeriodDraft.id,
      status: 'draft',
    });

    const res = await request(app)
      .post(`/api/v1/payroll/periods/${draftPayrollPeriod.id}/calculate`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('LOCKED attendance');

    await draftPayrollPeriod.destroy();
  });

  it('3. POST /api/v1/payroll/periods/:id/calculate -> Computes hourly and salaried payroll correctly', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/calculate`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('calculated');
    expect(res.body.data.blockingIssuesCount).toBe(0);

    // Hourly employee: 160h reg * 20 = 3200, 40h OT * 25 = 1000 => 4200 gross
    // Salaried employee: 8000 fixed basic => 8000 gross
    // Total gross = 4200 + 8000 = 12200
    expect(res.body.data.totalGrossPay).toBe(12200);
    expect(res.body.data.totalNetPay).toBe(12200);
  });

  it('4. GET /api/v1/payroll/periods/:id/items -> HR Admin can list period items and verify calculations', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);

    const hourlyItem = res.body.data.find((i: any) => i.employeeId === hourlyEmployee.id);
    const salariedItem = res.body.data.find((i: any) => i.employeeId === salariedEmployee.id);

    expect(hourlyItem).toBeDefined();
    expect(hourlyItem.remunerationBasis).toBe('hourly');
    expect(hourlyItem.totalRegularHours).toBe(160);
    expect(hourlyItem.totalOtHours).toBe(40);
    expect(hourlyItem.grossPay).toBe(4200);
    expect(hourlyItem.netPay).toBe(4200);
    expect(hourlyItem.hasBlockingIssue).toBe(false);

    expect(salariedItem).toBeDefined();
    expect(salariedItem.remunerationBasis).toBe('salaried');
    expect(salariedItem.grossPay).toBe(8000);
    expect(salariedItem.netPay).toBe(8000);

    hourlyItemId = hourlyItem.id;
  });

  it('5. GET /api/v1/payroll/periods/:id/items/:itemId -> Inspect item itemized line breakdown', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lines.length).toBe(40); // 20 regular + 20 overtime lines
    expect(res.body.data.lines.every((l: any) => !l.isManual)).toBe(true);
  });

  it('6. POST & DELETE /api/v1/payroll/periods/:id/items/:itemId/adjustments -> Manual adjustments workflow', async () => {
    // 6a: Validation check: description must be at least 5 chars
    const shortDescRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}/adjustments`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        adjustmentType: 'addition',
        amount: 250,
        description: 'Adj',
      });
    expect(shortDescRes.status).toBe(422);

    // 6b: Add valid addition adjustment (+250 AED)
    const addRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}/adjustments`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        adjustmentType: 'addition',
        amount: 250,
        description: 'Exemplary project performance bonus',
      });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.category).toBe('adjustment');
    expect(addRes.body.data.isManual).toBe(true);
    testAdjustmentLineId = addRes.body.data.id;

    // Verify hourly item net pay increased to 4450 (4200 + 250)
    const checkItemRes = await request(app)
      .get(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(checkItemRes.body.data.grossPay).toBe(4450);
    expect(checkItemRes.body.data.netPay).toBe(4450);

    // 6c: Recalculating period must PRESERVE the manual adjustment line
    const recalcRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/calculate`)
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(recalcRes.status).toBe(200);

    const recheckItemRes = await request(app)
      .get(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(recheckItemRes.body.data.grossPay).toBe(4450);
    expect(recheckItemRes.body.data.netPay).toBe(4450);
    expect(recheckItemRes.body.data.lines.some((l: any) => l.id === testAdjustmentLineId)).toBe(true);

    // 6d: Delete manual adjustment restores original balance
    const delRes = await request(app)
      .delete(
        `/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}/adjustments/${testAdjustmentLineId}`,
      )
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(delRes.status).toBe(200);

    const afterDelRes = await request(app)
      .get(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}`)
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(afterDelRes.body.data.grossPay).toBe(4200);
    expect(afterDelRes.body.data.netPay).toBe(4200);
  });

  it('7. POST /api/v1/payroll/periods/:id/review -> Transitions status from CALCULATED to REVIEWED', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/review`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('reviewed');
  });

  it('8. POST /api/v1/payroll/periods/:id/finalize -> Transitions status to FINALIZED and locks changes', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/finalize`)
      .set('Authorization', `Bearer ${hrAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('finalized');
    expect(res.body.data.finalizedAt).toBeDefined();

    // Confirm that adding an adjustment or recalculating a finalized period is blocked
    const blockedAdjRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/items/${hourlyItemId}/adjustments`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        adjustmentType: 'deduction',
        amount: 50,
        description: 'Late deduction after finalization',
      });
    expect(blockedAdjRes.status).toBe(400);

    const blockedCalcRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/calculate`)
      .set('Authorization', `Bearer ${hrAdminToken}`);
    expect(blockedCalcRes.status).toBe(400);
  });

  it('9. Employee Self-Service: GET /api/v1/payroll/my-payroll -> View own finalized payslip history', async () => {
    // Hourly employee user fetches history
    const res = await request(app)
      .get('/api/v1/payroll/my-payroll')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].payrollPeriodId).toBe(createdPayrollPeriodId);
    expect(res.body.data[0].netPay).toBe(4200);

    // Detail of payslip
    const payslipRes = await request(app)
      .get(`/api/v1/payroll/my-payroll/${createdPayrollPeriodId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(payslipRes.status).toBe(200);
    expect(payslipRes.body.success).toBe(true);
    expect(payslipRes.body.data.grossPay).toBe(4200);
    expect(payslipRes.body.data.earnings.length).toBe(40);
  });

  it('10. Unlock Workflow & RBAC Security -> Only Super Admin can unlock; HR Admin receives 403', async () => {
    // 10a: HR Admin attempt to unlock is forbidden (403)
    const hrUnlockRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/unlock`)
      .set('Authorization', `Bearer ${hrAdminToken}`)
      .send({
        reason: 'Supervisors need to adjust hours urgently',
      });
    expect(hrUnlockRes.status).toBe(403);

    // 10b: Reason shorter than 15 characters is rejected with 422
    const shortReasonRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/unlock`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        reason: 'Too short',
      });
    expect(shortReasonRes.status).toBe(422);

    // 10c: Super Admin unlocks with valid reason >= 15 chars
    const superUnlockRes = await request(app)
      .post(`/api/v1/payroll/periods/${createdPayrollPeriodId}/unlock`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        reason: 'Executive audit correction authorized by CFO',
      });
    expect(superUnlockRes.status).toBe(200);
    expect(superUnlockRes.body.success).toBe(true);
    expect(superUnlockRes.body.data.status).toBe('draft');
  });
});
