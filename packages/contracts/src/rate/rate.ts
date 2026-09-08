export interface EmployeeHourlyRateDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  normalHourlyRate: number;
  otHourlyRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeHourlyRateDto {
  employeeId: string;
  normalHourlyRate: number;
  otHourlyRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeReason?: string | null;
}

export interface UpdateEmployeeHourlyRateDto {
  effectiveTo?: string | null;
  changeReason?: string | null;
}

export interface ClientBillingRateDto {
  id: string;
  clientId: string;
  clientName?: string;
  projectId: string | null;
  projectName?: string | null;
  designationId: string;
  designationTitle?: string;
  normalBillingRate: number;
  otBillingRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientBillingRateDto {
  clientId: string;
  projectId?: string | null;
  designationId: string;
  normalBillingRate: number;
  otBillingRate: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateClientBillingRateDto {
  effectiveTo?: string | null;
  normalBillingRate?: number;
  otBillingRate?: number;
}

export interface ResolvedBillingRateDto {
  status: 'RESOLVED' | 'MISSING_ASSIGNMENT' | 'MISSING_BILLING_RATE';
  workDate: string;
  employeeId: string;
  clientId?: string;
  projectId?: string;
  designationId?: string;
  rateSource?: 'PROJECT_SPECIFIC' | 'CLIENT_WIDE_FALLBACK';
  normalBillingRate?: number;
  otBillingRate?: number;
  errorCode?: string;
  errorMessage?: string;
}
