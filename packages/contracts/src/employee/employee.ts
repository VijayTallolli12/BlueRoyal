export type EmployeeGender = 'male' | 'female' | 'other';
export type EmployeeStatus = 'active' | 'on_leave' | 'probation' | 'terminated' | 'resigned';

export interface EmployeeDto {
  id: string;
  employeeCode: string;
  userId: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: EmployeeGender;
  dateOfBirth: string;
  nationality: string;
  email: string | null;
  phoneNumber: string | null;
  dateOfJoining: string;
  probationEndDate: string | null;
  status: EmployeeStatus;
  currentDesignation?: {
    id: string;
    code: string;
    title: string;
  } | null;
  currentAssignment?: {
    id: string;
    clientId: string;
    projectId: string;
    clientName?: string;
    projectName?: string;
    designationId: string;
    designationTitle?: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDto {
  employeeCode: string;
  userId?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender: EmployeeGender;
  dateOfBirth: string;
  nationality: string;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfJoining: string;
  probationEndDate?: string | null;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeDto {
  userId?: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  gender?: EmployeeGender;
  dateOfBirth?: string;
  nationality?: string;
  email?: string | null;
  phoneNumber?: string | null;
  dateOfJoining?: string;
  probationEndDate?: string | null;
  status?: EmployeeStatus;
}
