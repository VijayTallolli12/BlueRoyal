import { sequelize } from '../../src/core/database/sequelize';
import { EffectiveDateService } from '../../src/core/services/effective-date.service';
import { EmployeeHourlyRate } from '../../src/modules/masters/models/employee-hourly-rate.model';
import { Employee } from '../../src/modules/masters/models/employee.model';
import { AppError } from '../../src/core/errors/app-error';

describe('Effective-Dating Point-in-Time Boundary Test Suite', () => {
  let testEmployeeId: string;

  beforeAll(async () => {
    await sequelize.authenticate();

    // Create a dedicated test employee
    const emp = await Employee.create({
      employeeCode: `TEST-EMP-${Date.now()}`,
      firstName: 'Temporal',
      lastName: 'Tester',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      nationality: 'Emirati',
      dateOfJoining: '2026-01-01',
      status: 'active',
    });
    testEmployeeId = emp.id;

    // Create a bounded historical rate: 2026-01-01 to 2026-06-30
    await EmployeeHourlyRate.create({
      employeeId: testEmployeeId,
      normalHourlyRate: 25.0,
      otHourlyRate: 37.5,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-06-30',
      changeReason: 'Initial rate',
    });

    // Create a current open-ended rate: 2026-07-01 to NULL
    await EmployeeHourlyRate.create({
      employeeId: testEmployeeId,
      normalHourlyRate: 30.0,
      otHourlyRate: 45.0,
      effectiveFrom: '2026-07-01',
      effectiveTo: null,
      changeReason: 'Mid-year increment',
    });
  });

  afterAll(async () => {
    if (testEmployeeId) {
      await EmployeeHourlyRate.destroy({ where: { employeeId: testEmployeeId } });
      await Employee.destroy({ where: { id: testEmployeeId }, force: true });
    }
  });

  // Test 1: Exact start date
  it('Condition 1 (Exact Start Date): should resolve rate on exact effective_from date', async () => {
    const rate = await EffectiveDateService.resolveAtDate(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2026-01-01',
    );
    expect(rate).not.toBeNull();
    expect(Number(rate!.normalHourlyRate)).toBe(25.0);
  });

  // Test 2: Exact end date
  it('Condition 2 (Exact End Date): should resolve rate on exact effective_to date', async () => {
    const rate = await EffectiveDateService.resolveAtDate(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2026-06-30',
    );
    expect(rate).not.toBeNull();
    expect(Number(rate!.normalHourlyRate)).toBe(25.0);
  });

  // Test 3: Date prior to start
  it('Condition 3 (Pre-Effective Date): should return null for date prior to first effective rate', async () => {
    const rate = await EffectiveDateService.resolveAtDate(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2025-12-31',
    );
    expect(rate).toBeNull();
  });

  // Test 4: Open-ended current date
  it('Condition 4 (Open-Ended Active Interval): should resolve ongoing rate for date after 2026-07-01', async () => {
    const rate = await EffectiveDateService.resolveAtDate(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2026-09-08',
    );
    expect(rate).not.toBeNull();
    expect(Number(rate!.normalHourlyRate)).toBe(30.0);
  });

  // Test 5: Overlapping interval rejection
  it('Condition 5 (Overlapping Interval Rejection): should reject overlapping rate insertion', async () => {
    await expect(
      EffectiveDateService.validateAndPrepareInterval(
        EmployeeHourlyRate,
        { employeeId: testEmployeeId },
        '2026-03-01',
        '2026-05-01',
        false, // do not auto close
      ),
    ).rejects.toThrow(AppError);
  });

  // Test 6: Auto-close open-ended interval
  it('Condition 6 (Auto-Close Prior Open-Ended Interval): should auto-close prior open-ended record when scheduling new rate', async () => {
    await EffectiveDateService.validateAndPrepareInterval(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2027-01-01',
      null,
      true, // auto close
    );

    // Verify that the prior rate (2026-07-01) is now closed on 2026-12-31
    const priorRate = await EmployeeHourlyRate.findOne({
      where: {
        employeeId: testEmployeeId,
        effectiveFrom: '2026-07-01',
      },
    });

    expect(priorRate).not.toBeNull();
    expect(priorRate!.effectiveTo).toBe('2026-12-31');
  });

  // Test 7: Historical lookups remain immutable
  it('Condition 7 (Historical Lookup Integrity): past point-in-time lookup reconstructs historical slice accurately', async () => {
    const pastRate = await EffectiveDateService.resolveAtDate(
      EmployeeHourlyRate,
      { employeeId: testEmployeeId },
      '2026-04-15',
    );
    expect(pastRate).not.toBeNull();
    expect(Number(pastRate!.normalHourlyRate)).toBe(25.0);
    expect(pastRate!.changeReason).toBe('Initial rate');
  });
});
