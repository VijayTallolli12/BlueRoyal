import { Transaction } from 'sequelize';
import { DayType } from '../models/attendance-record.model';
import { PublicHoliday, WeeklyOffConfig } from '../../masters/models/calendar.model';
import { EmployeeAssignment } from '../../masters/models/employee-assignment.model';
import { EmployeeShiftAssignment } from '../../masters/models/employee-shift-assignment.model';
import { Shift } from '../../masters/models/shift.model';
import { EffectiveDateService } from '../../../core/services/effective-date.service';

export interface CalculatedAttendanceHours {
  regularHours: number;
  otHours: number;
  isAbsent: boolean;
  hasAnomaly: boolean;
  anomalyReason: string | null;
}

export interface EmployeeEligibilityContext {
  dateOfJoining: string;
  employmentType: 'full_time' | 'contract';
  contractEndDate: string | null;
}

export interface PointInTimeContext {
  clientId: string | null;
  projectId: string | null;
  designationId: string | null;
  shiftId: string | null;
  shiftWorkHours: number | null;
}

export class AttendanceCalculationService {
  /**
   * Determine the DayType (public_holiday, weekly_off, or regular_workday) for a given date.
   */
  public static async resolveDayType(workDate: string, transaction?: Transaction): Promise<DayType> {
    // 1. Check Public Holidays
    const holiday = await PublicHoliday.findOne({
      where: { holidayDate: workDate },
      transaction,
    });
    if (holiday) {
      return 'public_holiday';
    }

    // 2. Check Weekly Off Configuration
    const weeklyOffConfig = await EffectiveDateService.resolveAtDate(
      WeeklyOffConfig,
      {},
      workDate,
      transaction,
    );

    const dayOfWeek = new Date(`${workDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    if (weeklyOffConfig && Array.isArray(weeklyOffConfig.daysOfWeek)) {
      if (weeklyOffConfig.daysOfWeek.includes(dayOfWeek)) {
        return 'weekly_off';
      }
    } else if (dayOfWeek === 0) {
      // Default Sunday fallback if no weekly off config is in place
      return 'weekly_off';
    }

    return 'regular_workday';
  }

  /**
   * Validates if an employee is eligible to work on a specific date.
   * Based on date_of_joining and contract_end_date.
   */
  public static isEmployeeEligibleOnDate(
    employee: EmployeeEligibilityContext,
    workDate: string,
  ): boolean {
    if (workDate < employee.dateOfJoining) {
      return false;
    }

    if (employee.employmentType === 'contract') {
      if (!employee.contractEndDate || workDate > employee.contractEndDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Point-in-time resolution for an employee's deployment and shift assignments on a specific work date.
   */
  public static async resolvePointInTimeContext(
    employeeId: string,
    workDate: string,
    transaction?: Transaction,
  ): Promise<PointInTimeContext> {
    // 1. Resolve Project/Client/Designation Assignment
    const assignment = await EffectiveDateService.resolveAtDate(
      EmployeeAssignment,
      { employeeId },
      workDate,
      transaction,
    );

    const clientId = assignment ? assignment.clientId : null;
    const projectId = assignment ? assignment.projectId : null;
    const designationId = assignment ? assignment.designationId : null;

    // 2. Resolve Shift Assignment
    const shiftAssignment = await EffectiveDateService.resolveAtDate(
      EmployeeShiftAssignment,
      { employeeId },
      workDate,
      transaction,
    );

    let shiftId: string | null = null;
    let shiftWorkHours: number | null = null;

    if (shiftAssignment) {
      const shift = await Shift.findByPk(shiftAssignment.shiftId, { transaction });
      if (shift && shift.isActive) {
        shiftId = shift.id;
        shiftWorkHours = Number(shift.workHours);
      }
    }

    return {
      clientId,
      projectId,
      designationId,
      shiftId,
      shiftWorkHours,
    };
  }

  /**
   * Pure calculation of regular hours, overtime hours, absence, and anomalies based on shift and day type.
   * Strict rule: Never assume 8.00 hours when shift is missing on regular workday.
   */
  public static calculateHours(params: {
    actualHours: number;
    dayType: DayType;
    shiftWorkHours: number | null;
    isOnLeave?: boolean;
  }): CalculatedAttendanceHours {
    const { actualHours, dayType, shiftWorkHours, isOnLeave = false } = params;

    // Phase 3 integration hook: Leave handling
    if (isOnLeave) {
      return {
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      };
    }

    // Public Holiday or Weekly Off
    if (dayType === 'public_holiday' || dayType === 'weekly_off') {
      if (actualHours > 0) {
        // Any hours worked on holiday/weekly off are 100% overtime
        return {
          regularHours: 0.0,
          otHours: Number(actualHours.toFixed(2)),
          isAbsent: false,
          hasAnomaly: false,
          anomalyReason: null,
        };
      }
      return {
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      };
    }

    // Regular Workday
    if (shiftWorkHours === null || shiftWorkHours <= 0) {
      // STRICT RULE: MISSING_SHIFT_ASSIGNMENT anomaly.
      // Retain actual_hours, set regular and OT to 0.00, flag anomaly.
      return {
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: actualHours === 0,
        hasAnomaly: true,
        anomalyReason: 'MISSING_SHIFT_ASSIGNMENT',
      };
    }

    if (actualHours === 0) {
      return {
        regularHours: 0.0,
        otHours: 0.0,
        isAbsent: true,
        hasAnomaly: false,
        anomalyReason: null,
      };
    }

    if (actualHours <= shiftWorkHours) {
      return {
        regularHours: Number(actualHours.toFixed(2)),
        otHours: 0.0,
        isAbsent: false,
        hasAnomaly: false,
        anomalyReason: null,
      };
    }

    // actualHours > shiftWorkHours
    const ot = Number((actualHours - shiftWorkHours).toFixed(2));
    return {
      regularHours: Number(shiftWorkHours.toFixed(2)),
      otHours: ot,
      isAbsent: false,
      hasAnomaly: false,
      anomalyReason: null,
    };
  }
}
