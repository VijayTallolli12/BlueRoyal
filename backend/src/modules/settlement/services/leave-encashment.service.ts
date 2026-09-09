import { EmployeeLeaveBalance } from '../../leave/models/employee-leave-balance.model';
import { LeaveType } from '../../leave/models/leave-type.model';
import { round2 } from '../../../core/utils/math.util';

export interface LeaveEncashmentResult {
  annualLeaveTypeId: string | null;
  remainingLeaveDays: number;
  dailyBasicWage: number;
  leaveSalaryAmount: number;
  isNegativeBalance: boolean;
  recoveryAmount: number;
}

export class LeaveEncashmentService {
  /**
   * Calculate statutory leave encashment (or excess leave recovery) upon separation.
   * Approved Rule BR-03: Calculated on Basic Wage only.
   */
  public static async calculateLeaveEncashment(params: {
    employeeId: string;
    lastWorkingDay: string;
    dailyBasicWage: number;
  }): Promise<LeaveEncashmentResult> {
    const exitYear = new Date(params.lastWorkingDay).getFullYear();

    const annualLeaveType = await LeaveType.findOne({
      where: { code: 'ANNUAL' },
    });

    let remainingLeaveDays = 0;
    let annualLeaveTypeId: string | null = null;

    if (annualLeaveType) {
      annualLeaveTypeId = annualLeaveType.id;
      const balance = await EmployeeLeaveBalance.findOne({
        where: {
          employeeId: params.employeeId,
          leaveTypeId: annualLeaveType.id,
          year: exitYear,
        },
      });

      if (balance) {
        remainingLeaveDays = Number(balance.remainingDays || 0);
      }
    }

    const dailyBasicWage = params.dailyBasicWage;
    const isNegativeBalance = remainingLeaveDays < 0;

    let leaveSalaryAmount = 0;
    let recoveryAmount = 0;

    if (remainingLeaveDays > 0) {
      leaveSalaryAmount = round2(remainingLeaveDays * dailyBasicWage);
    } else if (remainingLeaveDays < 0) {
      // Overdrawn leave: deducted as a recovery line item
      recoveryAmount = round2(Math.abs(remainingLeaveDays) * dailyBasicWage);
    }

    return {
      annualLeaveTypeId,
      remainingLeaveDays,
      dailyBasicWage,
      leaveSalaryAmount,
      isNegativeBalance,
      recoveryAmount,
    };
  }
}
