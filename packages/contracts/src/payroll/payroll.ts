import { RemunerationBasis } from '../employee/employee';

export type PayrollPeriodStatus = 'draft' | 'calculated' | 'reviewed' | 'finalized';
export type PayrollLineCategory = 'earning' | 'deduction' | 'adjustment';
export type PayrollAdjustmentType = 'addition' | 'deduction';

export interface PayrollPeriodDto {
  id: string;
  periodCode: string;
  name: string;
  startDate: string;
  endDate: string;
  attendancePeriodId: string;
  status: PayrollPeriodStatus;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  employeeCount: number;
  blockingIssuesCount: number;
  calculatedBy?: string | null;
  calculatedAt?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  unlockReason?: string | null;
  unlockedBy?: string | null;
  unlockedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItemDto {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  remunerationBasis: RemunerationBasis;
  designationId?: string | null;
  designationTitle?: string | null;
  daysInPeriod: number;
  totalActualHours: number;
  totalRegularHours: number;
  totalOtHours: number;
  totalAbsenceDays: number;
  totalLeaveDays: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  hasBlockingIssue: boolean;
  blockingReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollItemLineDto {
  id: string;
  payrollItemId: string;
  category: PayrollLineCategory;
  isManual: boolean;
  adjustmentType?: PayrollAdjustmentType | null;
  code: string;
  description: string;
  rate?: number | null;
  quantity?: number | null;
  amount: number;
  salaryComponentId?: string | null;
  workDate?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface CreatePayrollPeriodDto {
  attendancePeriodId: string;
  periodCode?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface AddPayrollAdjustmentDto {
  adjustmentType: PayrollAdjustmentType;
  amount: number;
  description: string;
}

export interface UnlockPayrollPeriodDto {
  reason: string;
}

export interface PayrollItemDetailDto {
  item: PayrollItemDto;
  lines: PayrollItemLineDto[];
  attendanceSummary: {
    totalActualHours: number;
    totalRegularHours: number;
    totalOtHours: number;
    totalAbsenceDays: number;
    totalLeaveDays: number;
  };
}

export interface EmployeePayslipDto {
  period: {
    id: string;
    periodCode: string;
    name: string;
    startDate: string;
    endDate: string;
    status: PayrollPeriodStatus;
  };
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    designation?: string | null;
    remunerationBasis: RemunerationBasis;
  };
  attendanceSummary: {
    daysWorked: number;
    regularHours: number;
    otHours: number;
    absenceDays: number;
    leaveDays: number;
  };
  earnings: PayrollItemLineDto[];
  deductions: PayrollItemLineDto[];
  adjustments: PayrollItemLineDto[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}
