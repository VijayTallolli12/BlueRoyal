import { AttendanceCalculationService } from '../../src/modules/attendance/services/attendance-calculation.service';

describe('Phase 2: AttendanceCalculationService Unit Tests', () => {
  describe('calculateHours (Regular Workday with Shift)', () => {
    const shiftWorkHours = 8.0;

    it('should mark absent with 0 regular and 0 OT when actualHours is 0', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'regular_workday',
        shiftWorkHours,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: true,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should record exact regular hours and 0 OT when actualHours <= shiftWorkHours', () => {
      const partial = AttendanceCalculationService.calculateHours({
        actualHours: 5.5,
        dayType: 'regular_workday',
        shiftWorkHours,
      });

      expect(partial).toEqual({
        regularHours: 5.5,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });

      const full = AttendanceCalculationService.calculateHours({
        actualHours: 8.0,
        dayType: 'regular_workday',
        shiftWorkHours,
      });

      expect(full).toEqual({
        regularHours: 8.0,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should cap regular hours at shiftWorkHours and calculate remainder as OT when actualHours > shiftWorkHours', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 10.5,
        dayType: 'regular_workday',
        shiftWorkHours,
      });

      expect(result).toEqual({
        regularHours: 8.0,
        otHours: 2.5,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });
  });

  describe('calculateHours (STRICT ZERO-ASSUMPTION Missing Shift Rule)', () => {
    it('should NEVER fallback to 8 hours and must flag MISSING_SHIFT_ASSIGNMENT anomaly when shift is missing', () => {
      const resultWorked = AttendanceCalculationService.calculateHours({
        actualHours: 8.0,
        dayType: 'regular_workday',
        shiftWorkHours: null,
      });

      expect(resultWorked).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: true,
        anomalyReason: 'MISSING_SHIFT_ASSIGNMENT',
      });

      const resultZero = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'regular_workday',
        shiftWorkHours: null,
      });

      expect(resultZero).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: true,
        hasAnomaly: true,
        anomalyReason: 'MISSING_SHIFT_ASSIGNMENT',
      });
    });
  });

  describe('calculateHours (Weekly Off & Public Holiday)', () => {
    it('should treat weekly off with 0 hours as non-absent and 0 hours', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'weekly_off',
        shiftWorkHours: 8.0,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should treat any hours worked on weekly off as 100% Overtime with 0 regular hours', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 6.5,
        dayType: 'weekly_off',
        shiftWorkHours: 8.0,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 6.5,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should treat public holiday with 0 hours as non-absent and 0 hours', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'public_holiday',
        shiftWorkHours: 8.0,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should treat any hours worked on public holiday as 100% Overtime with 0 regular hours', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 8.0,
        dayType: 'public_holiday',
        shiftWorkHours: 8.0,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 8.0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });
  });

  describe('calculateHours (Leave Hook)', () => {
    it('should zero regular and OT hours and set isAbsent=false when isOnLeave=true', () => {
      const result = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'regular_workday',
        shiftWorkHours: 8.0,
        isOnLeave: true,
      });

      expect(result).toEqual({
        regularHours: 0,
        otHours: 0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });
  });

  describe('isEmployeeEligibleOnDate (Employment Contract Eligibility)', () => {
    it('should reject dates prior to date_of_joining', () => {
      const eligible = AttendanceCalculationService.isEmployeeEligibleOnDate(
        {
          dateOfJoining: '2026-05-10',
          employmentType: 'full_time',
          contractEndDate: null,
        },
        '2026-05-09',
      );

      expect(eligible).toBe(false);
    });

    it('should accept dates on or after date_of_joining for full-time employee', () => {
      const eligibleOnJoining = AttendanceCalculationService.isEmployeeEligibleOnDate(
        {
          dateOfJoining: '2026-05-10',
          employmentType: 'full_time',
          contractEndDate: null,
        },
        '2026-05-10',
      );
      expect(eligibleOnJoining).toBe(true);

      const eligibleAfter = AttendanceCalculationService.isEmployeeEligibleOnDate(
        {
          dateOfJoining: '2026-05-10',
          employmentType: 'full_time',
          contractEndDate: null,
        },
        '2026-05-31',
      );
      expect(eligibleAfter).toBe(true);
    });

    it('should enforce contractEndDate strictly for contract employees', () => {
      const contractEmp = {
        dateOfJoining: '2026-05-01',
        employmentType: 'contract' as const,
        contractEndDate: '2026-05-20',
      };

      expect(
        AttendanceCalculationService.isEmployeeEligibleOnDate(contractEmp, '2026-05-15'),
      ).toBe(true);
      expect(
        AttendanceCalculationService.isEmployeeEligibleOnDate(contractEmp, '2026-05-20'),
      ).toBe(true);
      expect(
        AttendanceCalculationService.isEmployeeEligibleOnDate(contractEmp, '2026-05-21'),
      ).toBe(false);
    });
  });
});
