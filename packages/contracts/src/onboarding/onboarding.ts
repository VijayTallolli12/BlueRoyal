export type OnboardingStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

export type OnboardingStep =
  | 'personal_info'
  | 'employment'
  | 'assignment'
  | 'compensation'
  | 'documents'
  | 'review';

export interface OnboardingChecklist {
  personalInfo: boolean;
  employmentDetails: boolean;
  assignmentSetup: boolean;
  compensationSetup: boolean;
  mandatoryDocuments: boolean;
}

export interface EmployeeOnboardingDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  employeeStatus?: string;
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completionPercentage: number;
  checklistProgress: OnboardingChecklist;
  targetStartDate?: string | null;
  completedAt?: string | null;
  completedByUserId?: string | null;
  notes?: string | null;
  missingRequirements?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StartOnboardingDto {
  employeeId: string;
  targetStartDate?: string;
  notes?: string;
}

export interface UpdateOnboardingProgressDto {
  currentStep?: OnboardingStep;
  checklistProgress?: Partial<OnboardingChecklist>;
  notes?: string;
}

export interface CompleteOnboardingDto {
  activationStatus?: 'probation' | 'active';
  notes?: string;
}

export interface OnboardingStatsDto {
  totalOnboarding: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
}
