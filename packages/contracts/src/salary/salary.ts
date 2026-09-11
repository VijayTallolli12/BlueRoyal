export type SalaryComponentType = 'earning' | 'deduction';
export type CalculationType = 'fixed_amount' | 'percentage';

export interface SalaryComponentDto {
  id: string;
  code: string;
  name: string;
  type: SalaryComponentType;
  calculationType: CalculationType;
  percentageBasisComponentId: string | null;
  percentageBasisComponentName?: string;
  isRecurring: boolean;
  isWpsBasic: boolean;
  isWpsHousing: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryComponentDto {
  code: string;
  name: string;
  type: SalaryComponentType;
  calculationType: CalculationType;
  percentageBasisComponentId?: string | null;
  isRecurring?: boolean;
  isWpsBasic?: boolean;
  isWpsHousing?: boolean;
  isActive?: boolean;
}

export interface UpdateSalaryComponentDto {
  code?: string;
  name?: string;
  type?: SalaryComponentType;
  calculationType?: CalculationType;
  percentageBasisComponentId?: string | null;
  isRecurring?: boolean;
  isWpsBasic?: boolean;
  isWpsHousing?: boolean;
  isActive?: boolean;
}

export interface EmployeeSalaryStructureDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  componentId: string;
  componentCode?: string;
  componentName?: string;
  componentType?: SalaryComponentType;
  calculationType?: CalculationType;
  amountOrPercentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeSalaryStructureDto {
  employeeId: string;
  componentId: string;
  amountOrPercentage: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateEmployeeSalaryStructureDto {
  amountOrPercentage?: number;
  effectiveTo?: string | null;
}
