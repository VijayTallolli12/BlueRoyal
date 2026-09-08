export type AttendancePeriodStatus = 'draft' | 'submitted' | 'approved' | 'locked';
export type DayType = 'regular_workday' | 'weekly_off' | 'public_holiday';

export interface AttendancePeriodDto {
  id: string;
  periodCode: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AttendancePeriodStatus;
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  lockedBy?: string | null;
  lockedAt?: string | null;
  unlockedBy?: string | null;
  unlockedAt?: string | null;
  unlockReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendancePeriodDto {
  periodCode: string; // 'YYYY-MM'
  name?: string;
  startDate?: string;
  endDate?: string;
}

export interface UnlockAttendancePeriodDto {
  unlockReason: string; // Minimum 15 chars
}

export interface AttendanceRecordDto {
  id: string;
  attendancePeriodId: string;
  employeeId: string;
  workDate: string;
  clientId?: string | null;
  projectId?: string | null;
  designationId?: string | null;
  shiftId?: string | null;
  dayType: DayType;
  actualHours: number;
  regularHours: number;
  otHours: number;
  isAbsent: boolean;
  isOnLeave: boolean;
  hasAnomaly: boolean;
  anomalyReason?: string | null;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchUpdateAttendanceRecordItemDto {
  recordId?: string;
  employeeId?: string;
  workDate?: string;
  actualHours?: number;
  isOnLeave?: boolean;
  remarks?: string | null;
  changeReason?: string; // Required when updating
}

export interface BatchUpdateAttendanceRecordsDto {
  batchReason?: string;
  records: BatchUpdateAttendanceRecordItemDto[];
}

export interface AttendanceGridCellDto {
  id?: string;
  workDate: string;
  dayOfMonth: number;
  dayOfWeek: string;
  dayType: DayType;
  actualHours: number;
  regularHours: number;
  otHours: number;
  isAbsent: boolean;
  isOnLeave: boolean;
  hasAnomaly: boolean;
  anomalyReason?: string | null;
  isEligible: boolean; // False if outside employment dates
  shiftName?: string | null;
  shiftHours?: number | null;
}

export interface AttendanceGridRowSummaryDto {
  totalActualHours: number;
  totalRegularHours: number;
  totalOtHours: number;
  totalAbsences: number;
  anomalyCount: number;
}

export interface AttendanceGridRowDto {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designationTitle?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  shiftName?: string | null;
  shiftWorkHours?: number | null;
  employmentType?: string;
  days?: Record<number, AttendanceGridCellDto>; // dayOfMonth -> cell
  records?: Record<string, any>; // workDate -> record
  totalDaysPresent?: number;
  totalRegularHours?: number;
  totalOtHours?: number;
  totalActualHours?: number;
  anomalyCount?: number;
  summary?: AttendanceGridRowSummaryDto;
}

export interface AttendanceSummaryCardsDto {
  totalEmployees: number;
  totalActualHours: number;
  totalRegularHours: number;
  totalOtHours: number;
  totalAbsences: number;
  totalAnomalies: number;
}

export interface AttendanceGridResponseDto {
  period: AttendancePeriodDto;
  dates: string[];
  daysInMonth?: number;
  rows: AttendanceGridRowDto[];
  summary: AttendanceSummaryCardsDto;
  totals?: {
    activeHeadcount: number;
    totalActualHours: number;
    totalRegularHours: number;
    totalOtHours: number;
    blockingAnomalyCount: number; // Count of MISSING_SHIFT_ASSIGNMENT
  };
}

export interface AttendanceImportErrorDto {
  rowNumber: number;
  employeeCode?: string;
  workDate?: string;
  field?: string;
  day?: number;
  rawInput?: string;
  reason?: string;
  message?: string;
}

export interface AttendanceImportResultDto {
  dryRun: boolean;
  success: boolean;
  periodCode?: string;
  totalRowsAnalyzed?: number;
  totalRows?: number;
  validRows: number;
  errorCount: number;
  errors: AttendanceImportErrorDto[];
}

export interface AttendanceAuditLogDto {
  id: string;
  attendanceRecordId: string;
  employeeId: string;
  workDate: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeReason: string;
  actorId: string;
  actorEmail?: string | null;
  createdAt: string;
}

