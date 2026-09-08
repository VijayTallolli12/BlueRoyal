export interface ShiftDto {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  workHours: number;
  isNightShift: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftDto {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  workHours: number;
  isNightShift?: boolean;
  isActive?: boolean;
}

export interface UpdateShiftDto {
  code?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  workHours?: number;
  isNightShift?: boolean;
  isActive?: boolean;
}

export interface EmployeeShiftAssignmentDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  shiftId: string;
  shiftCode?: string;
  shiftName?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeShiftAssignmentDto {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateEmployeeShiftAssignmentDto {
  effectiveTo?: string | null;
}
