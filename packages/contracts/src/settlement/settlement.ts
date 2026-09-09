export type SeparationType =
  | 'resignation'
  | 'termination_with_notice'
  | 'contract_expiry'
  | 'mutual_agreement'
  | 'termination_probation'
  | 'termination_summary'
  | 'death';

export type SeparationStatus = 'pending' | 'cleared' | 'settled' | 'cancelled';

export type ClearanceStatus = 'pending' | 'partially_cleared' | 'fully_cleared';

export interface ClearanceDetails {
  itAssetsReturned: boolean;
  accessCardsReturned: boolean;
  loansReconciled: boolean;
  visaCancellationInitiated: boolean;
  simCardReturned?: boolean;
  uniformReturned?: boolean;
  remarks?: string;
}

export type SettlementStatus = 'draft' | 'in_review' | 'approved' | 'finalized' | 'cancelled';

export type SettlementLineCategory =
  | 'statutory'
  | 'wage'
  | 'leave'
  | 'benefit'
  | 'deduction'
  | 'recovery';

export type SettlementAdjustmentType = 'addition' | 'deduction';

export interface AirTicketPolicyDto {
  id: string;
  countryCode?: string | null;
  countryName: string;
  region: string;
  entitlementAmount: number;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAirTicketPolicyDto {
  countryCode?: string;
  countryName: string;
  region: string;
  entitlementAmount: number;
  isActive?: boolean;
  notes?: string;
}

export interface EmployeeSeparationDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  designationTitle?: string;
  separationType: SeparationType;
  noticeDate: string;
  lastWorkingDay: string;
  contractualNoticeDays: number;
  actualNoticeDays: number;
  noticeShortfallDays: number;
  reason?: string | null;
  repatriationRequired: boolean;
  destinationCountry?: string | null;
  hasNewUaeEmployment: boolean;
  clearanceStatus: ClearanceStatus;
  clearanceDetails: ClearanceDetails;
  status: SeparationStatus;
  settlementId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateSeparationDto {
  employeeId: string;
  separationType: SeparationType;
  noticeDate: string;
  lastWorkingDay: string;
  contractualNoticeDays?: number;
  actualNoticeDays?: number;
  reason?: string;
  repatriationRequired?: boolean;
  destinationCountry?: string;
  hasNewUaeEmployment?: boolean;
  clearanceDetails?: Partial<ClearanceDetails>;
}

export interface UpdateClearanceDto {
  clearanceDetails: Partial<ClearanceDetails>;
  clearanceStatus?: ClearanceStatus;
  reason?: string;
}

export interface SettlementItemLineDto {
  id: string;
  settlementId: string;
  category: SettlementLineCategory;
  code: string;
  description: string;
  isManual: boolean;
  adjustmentType: SettlementAdjustmentType;
  quantity?: number | null;
  rate?: number | null;
  amount: number;
  calculationNotes?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface AddSettlementLineDto {
  category: SettlementLineCategory;
  code: string;
  description: string;
  adjustmentType: SettlementAdjustmentType;
  quantity?: number;
  rate?: number;
  amount: number;
  calculationNotes?: string;
}

export interface FinalSettlementDto {
  id: string;
  settlementCode: string;
  separationId: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  department?: string;
  designationTitle?: string;
  serviceStartDate: string;
  lastWorkingDay: string;
  totalServiceCalendarDays: number;
  unpaidLeaveDays: number;
  netServiceDays: number;
  serviceYears: number;
  remunerationBasis: 'hourly' | 'salaried';
  lastBasicSalary: number;
  dailyBasicWage: number;
  dailyGrossWage?: number;
  gratuityAmount: number;
  gratuityWithheld?: boolean;
  gratuityWithholdReason?: string | null;
  leaveBalanceDays: number;
  leaveSalaryAmount: number;
  airTicketAmount: number;
  finalWagesAmount: number;
  noticeShortfallAmount?: number;
  grossAdditions: number;
  totalDeductions: number;
  netSettlementAmount: number;
  status: SettlementStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  notes?: string | null;
  lines?: SettlementItemLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CalculateSettlementDto {
  separationId: string;
  withholdGratuityArticle44?: boolean;
  withholdReason?: string;
  airTicketAllowanceOverride?: number;
  notes?: string;
}

export interface UnlockSettlementDto {
  reason: string;
}

export interface SettlementStatsDto {
  pendingSeparations: number;
  settlementsInReview: number;
  finalizedThisMonth: number;
  totalSettledAmountThisMonth: number;
}
