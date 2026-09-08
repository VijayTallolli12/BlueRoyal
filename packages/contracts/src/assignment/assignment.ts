export interface EmployeeAssignmentDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  clientId: string;
  clientName?: string;
  projectId: string;
  projectName?: string;
  designationId: string;
  designationTitle?: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeAssignmentDto {
  employeeId: string;
  clientId: string;
  projectId: string;
  designationId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  remarks?: string | null;
}

export interface UpdateEmployeeAssignmentDto {
  effectiveTo?: string | null;
  remarks?: string | null;
}
