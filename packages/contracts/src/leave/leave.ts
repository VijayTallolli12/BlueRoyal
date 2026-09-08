export interface LeaveTypeDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isPaid: boolean;
  defaultDaysPerYear: number;
  requiresAttachment: boolean;
  deductWorkingDaysOnly: boolean;
  allowDuringProbation: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeDto {
  code: string;
  name: string;
  description?: string;
  isPaid?: boolean;
  defaultDaysPerYear?: number;
  requiresAttachment?: boolean;
  deductWorkingDaysOnly?: boolean;
  allowDuringProbation?: boolean;
  isActive?: boolean;
}

export interface UpdateLeaveTypeDto {
  name?: string;
  description?: string;
  isPaid?: boolean;
  defaultDaysPerYear?: number;
  requiresAttachment?: boolean;
  deductWorkingDaysOnly?: boolean;
  allowDuringProbation?: boolean;
  isActive?: boolean;
}

export interface EmployeeLeaveBalanceDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  carriedForward: number;
  remainingDays: number;
  notes?: string | null;
  leaveType?: LeaveTypeDto;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AllocateLeaveBalanceDto {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  allocatedDays: number;
  carriedForward?: number;
  notes?: string;
}

export interface LeaveBalanceQueryDto {
  employeeId?: string;
  leaveTypeId?: string;
  year?: number;
}

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequestDto {
  id: string;
  requestNumber: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveRequestStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  attachmentUrl?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  leaveType?: LeaveTypeDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveRequestDto {
  employeeId?: string; // Optional when requested via /my-leave (derived from session)
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentUrl?: string;
}

export interface RejectLeaveRequestDto {
  rejectionReason: string;
}

export interface CancelLeaveRequestDto {
  cancellationReason?: string;
}

export interface LeaveRequestQueryDto {
  employeeId?: string;
  leaveTypeId?: string;
  status?: LeaveRequestStatus;
  year?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface MyLeaveOverviewDto {
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
  };
  year: number;
  balances: EmployeeLeaveBalanceDto[];
  requests: LeaveRequestDto[];
}
