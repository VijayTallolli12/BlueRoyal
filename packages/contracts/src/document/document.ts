export type ExpiryStatus =
  | 'valid'
  | 'approaching_expiry'
  | 'critical_expiry'
  | 'expired'
  | 'not_applicable';

export type DocumentVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface DocumentTypeDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isMandatoryForOnboarding: boolean;
  hasExpiry: boolean;
  defaultExpiryAlertDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentTypeDto {
  code: string;
  name: string;
  description?: string;
  isMandatoryForOnboarding?: boolean;
  hasExpiry?: boolean;
  defaultExpiryAlertDays?: number;
}

export interface UpdateDocumentTypeDto {
  name?: string;
  description?: string;
  isMandatoryForOnboarding?: boolean;
  hasExpiry?: boolean;
  defaultExpiryAlertDays?: number;
  isActive?: boolean;
}

export interface EmployeeDocumentDto {
  id: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  documentTypeId: string;
  documentTypeCode?: string;
  documentTypeName?: string;
  documentNumber?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  verificationStatus: DocumentVerificationStatus;
  verifiedByUserId?: string | null;
  verifiedAt?: string | null;
  verificationRemarks?: string | null;
  notes?: string | null;
  isActive: boolean;
  daysRemaining?: number | null;
  expiryStatus: ExpiryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeDocumentDto {
  employeeId: string;
  documentTypeId: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
  notes?: string;
}

export interface UpdateEmployeeDocumentDto {
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface VerifyDocumentDto {
  verificationStatus: 'verified' | 'rejected';
  verificationRemarks?: string;
}

export interface DocumentFilterParams {
  employeeId?: string;
  documentTypeId?: string;
  verificationStatus?: DocumentVerificationStatus;
  expiryStatus?: ExpiryStatus;
  thresholdDays?: number;
  search?: string;
}

export interface DocumentStatsDto {
  totalDocuments: number;
  verifiedCount: number;
  pendingCount: number;
  rejectedCount: number;
  validCount: number;
  approachingExpiryCount: number;
  criticalExpiryCount: number;
  expiredCount: number;
}
