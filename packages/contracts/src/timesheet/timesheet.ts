export interface FillStandardHoursDto {
  periodId: string;
  projectId: string;
  designationId?: string | null;
}

export interface FillStandardHoursResultDto {
  updatedRecords: number;
  skippedLeave: number;
  skippedHoliday: number;
  skippedWeeklyOff: number;
  createdRecords: number;
}

export interface TimesheetProjectEmployeeDto {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designationId: string;
  designationTitle: string;
}

export interface TimesheetDesignationFilterDto {
  id: string;
  code: string;
  title: string;
}

export interface TimesheetSupervisorDto {
  id: string;
  employeeCode: string;
  name: string;
}

export interface AssignWorkerDto {
  employeeId: string;
  designationId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  remarks?: string | null;
}
