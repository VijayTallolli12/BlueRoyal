export type EmployeeGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type EmployeeStatus = 'active' | 'on_leave' | 'probation' | 'terminated' | 'resigned' | 'inactive';
export type EmploymentType = 'full_time' | 'contract';
export type RemunerationBasis = 'hourly' | 'salaried';

export const EMPLOYEE_COUNTRIES: readonly string[] = [
  'India',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Oman',
  'Kuwait',
  'Bahrain',
  'Philippines',
  'Egypt',
  'United Kingdom',
  'United States',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'Nepal',
  'Other',
] as const;

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
  address?: string | null;
  country?: string | null;
  profilePhoto?: string | null;
  dateOfJoining: string;
  employmentType: EmploymentType;
  remunerationBasis: RemunerationBasis;
  contractEndDate: string | null;
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
  address?: string | null;
  country?: string | null;
  profilePhoto?: string | null;
  dateOfJoining: string;
  employmentType?: EmploymentType;
  remunerationBasis?: RemunerationBasis;
  contractEndDate?: string | null;
  probationEndDate?: string | null;
  status?: EmployeeStatus;
}

export interface UpdateEmployeeDto {
  employeeCode?: string;
  userId?: string | null;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  gender?: EmployeeGender;
  dateOfBirth?: string;
  nationality?: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  country?: string | null;
  profilePhoto?: string | null;
  dateOfJoining?: string;
  employmentType?: EmploymentType;
  remunerationBasis?: RemunerationBasis;
  contractEndDate?: string | null;
  probationEndDate?: string | null;
  status?: EmployeeStatus;
}

