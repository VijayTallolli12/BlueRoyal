import { LeaveCalculationService } from '../../src/modules/leave/services/leave-calculation.service';
import { AttendanceCalculationService } from '../../src/modules/attendance/services/attendance-calculation.service';
import { LeaveType } from '../../src/modules/leave/models/leave-type.model';

describe('Phase 3: LeaveCalculationService Unit Tests', () => {
  describe('getDatesInRange', () => {
    it('should generate continuous dates including start and end', () => {
      const dates = LeaveCalculationService.getDatesInRange('2026-09-01', '2026-09-05');
      expect(dates).toEqual([
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
      ]);
    });

    it('should return single date array when start date equals end date', () => {
      const dates = LeaveCalculationService.getDatesInRange('2026-09-10', '2026-09-10');
      expect(dates).toEqual(['2026-09-10']);
    });
  });

  describe('AttendanceCalculationService with isOnLeave hook', () => {
    it('should calculate 0 regular, 0 OT, and not absent when employee is on approved leave with 0 actual hours', () => {
      const res = AttendanceCalculationService.calculateHours({
        actualHours: 0,
        dayType: 'regular_workday',
        shiftWorkHours: 8.0,
        isOnLeave: true,
      });

      expect(res).toEqual({
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      });
    });

    it('should flag CONFLICT_LEAVE_WORK_LOGGED anomaly if actual hours are logged on an approved leave day', () => {
      const res = AttendanceCalculationService.calculateHours({
        actualHours: 4.5,
        dayType: 'regular_workday',
        shiftWorkHours: 8.0,
        isOnLeave: true,
      });

      expect(res).toEqual({
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: true,
        anomalyReason: 'CONFLICT_LEAVE_WORK_LOGGED',
      });
    });
  });

  describe('Eligibility and probation validations', () => {
    it('should reject if startDate is prior to dateOfJoining', async () => {
      const mockEmployee = {
        id: 'emp-1',
        dateOfJoining: '2026-05-01',
        employmentType: 'full_time',
        status: 'active',
      } as any;

      const mockLeaveType = {
        name: 'Annual Leave',
        allowDuringProbation: true,
      } as LeaveType;

      await expect(
        LeaveCalculationService.validateEligibilityAndOverlap({
          employee: mockEmployee,
          leaveType: mockLeaveType,
          startDate: '2026-04-15',
          endDate: '2026-04-20',
        }),
      ).rejects.toThrow('Leave start date (2026-04-15) cannot be prior to employee joining date (2026-05-01)');
    });

    it('should reject if contract employee endDate exceeds contractEndDate', async () => {
      const mockEmployee = {
        id: 'emp-2',
        dateOfJoining: '2026-01-01',
        employmentType: 'contract',
        contractEndDate: '2026-06-30',
        status: 'active',
      } as any;

      const mockLeaveType = {
        name: 'Annual Leave',
        allowDuringProbation: true,
      } as LeaveType;

      await expect(
        LeaveCalculationService.validateEligibilityAndOverlap({
          employee: mockEmployee,
          leaveType: mockLeaveType,
          startDate: '2026-06-25',
          endDate: '2026-07-05',
        }),
      ).rejects.toThrow('Leave end date (2026-07-05) exceeds employee contract end date (2026-06-30)');
    });

    it('should reject probation employees for leave types with allowDuringProbation = false', async () => {
      const mockEmployee = {
        id: 'emp-3',
        dateOfJoining: '2026-08-01',
        employmentType: 'full_time',
        contractEndDate: null,
        status: 'probation',
      } as any;

      const mockLeaveType = {
        name: 'Annual Vacation Leave',
        allowDuringProbation: false,
      } as LeaveType;

      await expect(
        LeaveCalculationService.validateEligibilityAndOverlap({
          employee: mockEmployee,
          leaveType: mockLeaveType,
          startDate: '2026-09-01',
          endDate: '2026-09-05',
        }),
      ).rejects.toThrow('Leave type "Annual Vacation Leave" is not permitted during employee probation period');
    });
  });
});
