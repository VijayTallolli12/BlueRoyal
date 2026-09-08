import { Op, Transaction } from 'sequelize';
import { LeaveType } from '../models/leave-type.model';
import { LeaveRequest } from '../models/leave-request.model';
import { Employee } from '../../masters/models/employee.model';
import { AttendanceCalculationService } from '../../attendance/services/attendance-calculation.service';
import { AppError } from '../../../core/errors/app-error';

export interface DateRangeCalculationResult {
  totalDays: number;
  breakdown: Array<{
    date: string;
    dayType: string;
    isDeducted: boolean;
  }>;
}

export class LeaveCalculationService {
  /**
   * Generates array of ISO date strings (YYYY-MM-DD) between startDate and endDate inclusive.
   */
  public static getDatesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates;
  }

  /**
   * Calculates total deducted days for a leave request based on leave type configuration.
   * If deductWorkingDaysOnly is true, skips weekly offs and public holidays.
   */
  public static async calculateLeaveDays(
    startDate: string,
    endDate: string,
    leaveType: LeaveType,
    transaction?: Transaction,
  ): Promise<DateRangeCalculationResult> {
    if (startDate > endDate) {
      throw new AppError('Start date must be before or equal to end date', 422);
    }

    const dates = this.getDatesInRange(startDate, endDate);
    let totalDays = 0;
    const breakdown: Array<{ date: string; dayType: string; isDeducted: boolean }> = [];

    for (const d of dates) {
      const dayType = await AttendanceCalculationService.resolveDayType(d, transaction);
      let isDeducted = true;

      if (leaveType.deductWorkingDaysOnly) {
        if (dayType === 'weekly_off' || dayType === 'public_holiday') {
          isDeducted = false;
        }
      }

      if (isDeducted) {
        totalDays += 1;
      }

      breakdown.push({
        date: d,
        dayType,
        isDeducted,
      });
    }

    return {
      totalDays: Number(totalDays.toFixed(2)),
      breakdown,
    };
  }

  /**
   * Validates employee employment eligibility and checks for overlapping leave requests.
   */
  public static async validateEligibilityAndOverlap(params: {
    employee: Employee;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    excludeRequestId?: string;
    transaction?: Transaction;
  }): Promise<void> {
    const { employee, leaveType, startDate, endDate, excludeRequestId, transaction } = params;

    // 1. Contract / Employment Date Boundaries
    if (startDate < employee.dateOfJoining) {
      throw new AppError(
        `Leave start date (${startDate}) cannot be prior to employee joining date (${employee.dateOfJoining})`,
        422,
      );
    }

    if (employee.employmentType === 'contract' && employee.contractEndDate) {
      if (endDate > employee.contractEndDate) {
        throw new AppError(
          `Leave end date (${endDate}) exceeds employee contract end date (${employee.contractEndDate})`,
          422,
        );
      }
    }

    // 2. Probation Restriction
    if (!leaveType.allowDuringProbation && employee.status === 'probation') {
      throw new AppError(
        `Leave type "${leaveType.name}" is not permitted during employee probation period`,
        422,
      );
    }

    // 3. Overlap Prevention: Check for existing PENDING or APPROVED requests
    const overlapWhere: any = {
      employeeId: employee.id,
      status: { [Op.in]: ['PENDING', 'APPROVED'] },
      [Op.and]: [
        { startDate: { [Op.lte]: endDate } },
        { endDate: { [Op.gte]: startDate } },
      ],
    };

    if (excludeRequestId) {
      overlapWhere.id = { [Op.ne]: excludeRequestId };
    }

    const conflictingRequest = await LeaveRequest.findOne({
      where: overlapWhere,
      transaction,
    });

    if (conflictingRequest) {
      throw new AppError(
        `An active leave request (${conflictingRequest.requestNumber}) already covers date range ` +
          `[${conflictingRequest.startDate} to ${conflictingRequest.endDate}] for this employee`,
        409,
      );
    }
  }
}
