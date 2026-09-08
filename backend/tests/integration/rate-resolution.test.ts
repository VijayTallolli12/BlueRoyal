import { sequelize } from '../../src/core/database/sequelize';
import { BillingRateResolutionService } from '../../src/modules/masters/services/billing-rate-resolution.service';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { Client } from '../../src/modules/masters/models/client.model';
import { Project } from '../../src/modules/masters/models/project.model';
import { Designation } from '../../src/modules/masters/models/designation.model';
import { EmployeeAssignment } from '../../src/modules/masters/models/employee-assignment.model';
import { ClientBillingRate } from '../../src/modules/masters/models/client-billing-rate.model';

describe('Dual-Stream Four-Rate Resolution Flow Integration Test', () => {
  let empId: string;
  let clientId: string;
  let projectId: string;
  let desId: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    const timestamp = Date.now();

    // 1. Designation
    const des = await Designation.create({
      code: `DES-TEST-${timestamp}`,
      title: 'Certified Electrician',
    });
    desId = des.id;

    // 2. Client
    const client = await Client.create({
      code: `CLI-TEST-${timestamp}`,
      name: 'Emaar Hospitality Group',
    });
    clientId = client.id;

    // 3. Project
    const project = await Project.create({
      clientId,
      code: `PRJ-TEST-${timestamp}`,
      name: 'Downtown Tower Phase 2',
    });
    projectId = project.id;

    // 4. Employee
    const emp = await Employee.create({
      employeeCode: `EMP-RATE-${timestamp}`,
      firstName: 'Rate',
      lastName: 'Tester',
      gender: 'male',
      dateOfBirth: '1992-05-15',
      nationality: 'Indian',
      dateOfJoining: '2026-01-01',
      status: 'active',
    });
    empId = emp.id;

    // 5. Active Assignment on 2026-06-01
    await EmployeeAssignment.create({
      employeeId: empId,
      clientId,
      projectId,
      designationId: desId,
      effectiveFrom: '2026-06-01',
      effectiveTo: null,
    });
  });

  afterAll(async () => {
    await ClientBillingRate.destroy({ where: { clientId } });
    await EmployeeAssignment.destroy({ where: { employeeId: empId } });
    await Employee.destroy({ where: { id: empId }, force: true });
    await Project.destroy({ where: { id: projectId }, force: true });
    await Client.destroy({ where: { id: clientId }, force: true });
    await Designation.destroy({ where: { id: desId } });
  });

  it('Step 1: should return UNASSIGNED_EMPLOYEE when resolving on date prior to assignment', async () => {
    const result = await BillingRateResolutionService.resolveBillingRate(empId, '2026-05-31');
    expect(result.status).toBe('MISSING_ASSIGNMENT');
    expect(result.errorCode).toBe('UNASSIGNED_EMPLOYEE');
  });

  it('Step 2: should return MISSING_BILLING_RATE when no rate is yet configured', async () => {
    const result = await BillingRateResolutionService.resolveBillingRate(empId, '2026-06-15');
    expect(result.status).toBe('MISSING_BILLING_RATE');
    expect(result.errorCode).toBe('MISSING_BILLING_RATE');
  });

  it('Step 3: should return CLIENT_WIDE_FALLBACK when only client-wide rate exists', async () => {
    // Add client-wide default rate (projectId IS NULL)
    await ClientBillingRate.create({
      clientId,
      projectId: null,
      designationId: desId,
      normalBillingRate: 40.0,
      otBillingRate: 60.0,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    });

    const result = await BillingRateResolutionService.resolveBillingRate(empId, '2026-06-15');
    expect(result.status).toBe('RESOLVED');
    expect(result.rateSource).toBe('CLIENT_WIDE_FALLBACK');
    expect(result.normalBillingRate).toBe(40.0);
    expect(result.otBillingRate).toBe(60.0);
  });

  it('Step 4: should return PROJECT_SPECIFIC rate taking precedence over client-wide fallback', async () => {
    // Add project-specific rate with higher pricing
    await ClientBillingRate.create({
      clientId,
      projectId,
      designationId: desId,
      normalBillingRate: 55.0,
      otBillingRate: 82.5,
      effectiveFrom: '2026-06-01',
      effectiveTo: null,
    });

    const result = await BillingRateResolutionService.resolveBillingRate(empId, '2026-06-15');
    expect(result.status).toBe('RESOLVED');
    expect(result.rateSource).toBe('PROJECT_SPECIFIC');
    expect(result.normalBillingRate).toBe(55.0);
    expect(result.otBillingRate).toBe(82.5);
  });
});
