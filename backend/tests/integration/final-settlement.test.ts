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
import { EmployeeLeaveBalance } from '../../src/modules/leave/models/employee-leave-balance.model';
import { LeaveType } from '../../src/modules/leave/models/leave-type.model';
import { AirTicketPolicy } from '../../src/modules/settlement/models/air-ticket-policy.model';
import { EmployeeSeparation } from '../../src/modules/settlement/models/employee-separation.model';
import { FinalSettlement } from '../../src/modules/settlement/models/final-settlement.model';
import { SettlementItemLine } from '../../src/modules/settlement/models/settlement-item-line.model';

describe('Phase 6: Final Settlement, Gratuity, Leave Salary & Air Tickets Integration Tests', () => {
  const app = createApp();
  let superAdminToken: string;
  let hrAdminToken: string;
  let employeeToken: string;

  let empHourly: Employee;
  let userHourly: User;
  let empSalaried: Employee;
  let userSalaried: User;

  let separationHourly: EmployeeSeparation;
  let createdSettlementId: string;

  const rand = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await sequelize.authenticate();

    // 1. Super Admin
    const adminUser = await User.findOne({ where: { email: 'admin@blueroyal.com' } });
    if (!adminUser) throw new Error('Super admin user must be seeded');
    superAdminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, roles: ['super_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 2. HR Admin
    const hrRole = await Role.findOne({ where: { name: 'hr_admin' } });
    const hrUser = await User.create({
      email: `hr.settlement.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'HR',
      lastName: 'Settlement',
      isActive: true,
    });
    if (hrRole) {
      await UserRole.create({ userId: hrUser.id, roleId: hrRole.id });
    }
    hrAdminToken = jwt.sign(
      { userId: hrUser.id, email: hrUser.email, roles: ['hr_admin'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    // 3. Hourly Employee
    userHourly = await User.create({
      email: `hourly.worker.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'Worker',
      lastName: 'Hourly',
      isActive: true,
    });
    const empRole = await Role.findOne({ where: { name: 'employee' } });
    if (empRole) {
      await UserRole.create({ userId: userHourly.id, roleId: empRole.id });
    }
    employeeToken = jwt.sign(
      { userId: userHourly.id, email: userHourly.email, roles: ['employee'] },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' },
    );

    empHourly = await Employee.create({
      userId: userHourly.id,
      employeeCode: `HRLY-${rand}`,
      firstName: 'Worker',
      lastName: 'Hourly',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'PHL',
      dateOfJoining: '2023-01-01',
      employmentType: 'full_time',
      remunerationBasis: 'hourly',
      status: 'active',
      department: 'Operations',
    });

    await EmployeeHourlyRate.create({
      employeeId: empHourly.id,
      normalHourlyRate: 20.0,
      otHourlyRate: 25.0,
      effectiveFrom: '2023-01-01',
      effectiveTo: null,
    });

    // 4. Salaried Employee
    userSalaried = await User.create({
      email: `salaried.staff.${rand}@blueroyal.com`,
      passwordHash: 'dummy_hash',
      firstName: 'Staff',
      lastName: 'Salaried',
      isActive: true,
    });

    empSalaried = await Employee.create({
      userId: userSalaried.id,
      employeeCode: `SAL-${rand}`,
      firstName: 'Staff',
      lastName: 'Salaried',
      gender: 'female',
      dateOfBirth: '1992-05-15',
      nationality: 'IND',
      dateOfJoining: '2024-01-01',
      employmentType: 'full_time',
      remunerationBasis: 'salaried',
      status: 'active',
      department: 'HR',
    });

    const basicComp = await SalaryComponent.findOne({ where: { isWpsBasic: true } });
    if (basicComp) {
      await EmployeeSalaryStructure.create({
        employeeId: empSalaried.id,
        componentId: basicComp.id,
        calculationType: 'fixed',
        amountOrPercentage: 6000.0,
        effectiveFrom: '2024-01-01',
        effectiveTo: null,
      });
    }

    // Leave balances
    const annualLeave = await LeaveType.findOne({ where: { code: 'ANNUAL' } });
    if (annualLeave) {
      await EmployeeLeaveBalance.create({
        employeeId: empHourly.id,
        leaveTypeId: annualLeave.id,
        year: 2026,
        allocatedDays: 30,
        usedDays: 10,
        pendingDays: 0,
        remainingDays: 20,
      });
    }
  });

  describe('1. Separation Management & Clearance Workflow', () => {
    it('HR Admin can initiate employee separation with notice period shortfall', async () => {
      const res = await request(app)
        .post('/api/v1/separations')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          employeeId: empHourly.id,
          separationType: 'resignation',
          reason: 'Better career opportunity',
          noticeDate: '2026-01-01',
          contractualNoticeDays: 30,
          actualNoticeDays: 20, // 10 days shortfall
          lastWorkingDay: '2026-01-20',
          repatriationRequired: true,
          destinationCountry: 'PHL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employeeId).toBe(empHourly.id);
      expect(res.body.data.clearanceStatus).toBe('pending');
      expect(res.body.data.noticeShortfallDays).toBe(10);

      separationHourly = await EmployeeSeparation.findByPk(res.body.data.id) as EmployeeSeparation;
    });

    it('HR Admin can update clearance checklist items', async () => {
      const res = await request(app)
        .put(`/api/v1/separations/${separationHourly.id}/clearance`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          clearanceDetails: {
            itAssetsReturned: true,
            accessCardsReturned: true,
          },
          reason: 'Equipment returned to IT',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.clearanceStatus).toBe('partially_cleared');
    });
  });

  describe('2. Final Settlement Calculation Engine & Approved Business Rules', () => {
    it('calculates settlement preview with Hourly Rule BR-01, BR-02, BR-03, and Air Ticket Policy BR-04', async () => {
      const res = await request(app)
        .post('/api/v1/settlements/calculate')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          employeeId: empHourly.id,
          separationId: separationHourly.id,
          lastWorkingDay: '2026-01-20',
          repatriationRequired: true,
          destinationCountry: 'PHL',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      // BR-01: Hourly base 20.0 * 8 * 30 = 4,800.00
      expect(data.lastBasicSalary).toBe(4800.0);
      // BR-02: 4,800 / 30 = 160.00
      expect(data.dailyBasicWage).toBe(160.0);

      // Duration: 2023-01-01 to 2026-01-20 is ~3.05 years (> 1 year, <= 5 years)
      expect(data.serviceYears).toBeGreaterThanOrEqual(3.0);
      expect(data.gratuityAmount).toBeGreaterThan(0);

      // BR-03: Leave balance encashment = 20 days * 160 = 3,200.00
      expect(data.leaveSalaryAmount).toBe(3200.0);

      // BR-04: Philippines Air Ticket from seeded policy (2,000 AED)
      expect(data.airTicketAmount).toBe(2000.0);

      // Lines breakdown present
      expect(data.lines.length).toBeGreaterThanOrEqual(3);
    });

    it('creates Draft Settlement Voucher', async () => {
      const res = await request(app)
        .post('/api/v1/settlements')
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          employeeId: empHourly.id,
          separationId: separationHourly.id,
          lastWorkingDay: '2026-01-20',
          repatriationRequired: true,
          destinationCountry: 'PHL',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('draft');
      createdSettlementId = res.body.data.id;
    });
  });

  describe('3. Statutory Protections & Guardrails', () => {
    it('STRICT STATUTORY GUARDRAIL: Prohibits adding visa/recruitment clawback line (Rule BR-07)', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/lines`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          category: 'deduction',
          code: 'VISA_CLAWBACK',
          description: 'Recovery of residence visa fees',
          adjustmentType: 'deduction',
          amount: 2500.0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('prohibited under UAE Labor Law');
    });

    it('allows valid manual deduction (e.g. lost company tool)', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/lines`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          category: 'deduction',
          code: 'LOST_TOOL',
          description: 'Drill set replacement charge',
          adjustmentType: 'deduction',
          amount: 350.0,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.totalDeductions).toBeGreaterThanOrEqual(350.0);
    });
  });

  describe('4. Voucher Approval Lifecycle & Super Admin Unlock Override', () => {
    it('submits voucher for review', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/review`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('in_review');
    });

    it('approves voucher', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/approve`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });

    it('finalizes voucher and automatically terminates employee and deactivates user', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/finalize`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          paymentMethod: 'bank_transfer',
          paymentReference: 'WPS-EXIT-20260120-99',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('finalized');

      // Verify cascading employee termination and user deactivation
      const emp = await Employee.findByPk(empHourly.id);
      expect(emp?.status).toBe('terminated');

      const usr = await User.findByPk(userHourly.id);
      expect(usr?.isActive).toBe(false);
    });

    it('SUPER ADMIN UNLOCK OVERRIDE: Rejects unlock if reason is < 15 characters', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/unlock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          reason: 'Short reason',
        });

      expect(res.status).toBe(400); // Bad Request (min 15 chars)
    });

    it('SUPER ADMIN UNLOCK OVERRIDE: Rejects non-super-admin from unlocking', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/unlock`)
        .set('Authorization', `Bearer ${hrAdminToken}`)
        .send({
          reason: 'Legal dispute raised regarding final calculations',
        });

      expect(res.status).toBe(403);
    });

    it('SUPER ADMIN UNLOCK OVERRIDE: Super Admin can unlock with valid reason and reactivates user', async () => {
      const res = await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/unlock`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          reason: 'Legal dispute raised regarding final calculations and severance package',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('draft');
      expect(res.body.data.notes).toContain('[UNLOCKED');

      const usr = await User.findByPk(userHourly.id);
      expect(usr?.isActive).toBe(true);
    });
  });

  describe('5. Employee Self-Service (ESS)', () => {
    it('allows employee to view their settlement', async () => {
      // Re-finalize voucher so it is visible to employee
      await request(app)
        .post(`/api/v1/settlements/${createdSettlementId}/finalize`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send();

      // Temporarily ensure user is active to authenticate
      await User.update({ isActive: true }, { where: { id: userHourly.id } });

      const res = await request(app)
        .get('/api/v1/settlements/my-settlement')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.employeeId).toBe(empHourly.id);
    });
  });
});
