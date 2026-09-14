export type PaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'CARD' | 'OTHER';

export type PaymentRecordStatus = 'RECORDED' | 'REVERSED';

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface RecordPaymentDto {
  clientId: string;
  invoiceId: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  notes?: string | null;
}

export interface ReversePaymentDto {
  reason: string;
}

export interface PaymentAllocationDto {
  id: string;
  paymentId: string;
  invoiceId: string;
  invoiceNumber?: string;
  allocatedAmount: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDto {
  id: string;
  paymentNumber: string;
  clientId: string;
  clientName?: string;
  paymentDate: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  status: PaymentRecordStatus;
  recordedBy: string;
  recordedByName?: string;
  recordedAt: string;
  reversedAt: string | null;
  reversedBy: string | null;
  reversedByName?: string | null;
  reversalReason: string | null;
  allocations?: PaymentAllocationDto[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePaymentSummaryDto {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  invoiceTotal: number;
  paid: number;
  outstanding: number;
  paymentStatus: InvoicePaymentStatus;
  currency: string;
  dueDate: string | null;
  payments: PaymentDto[];
}

export interface ReceivableInvoiceDto {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  billingPeriod: string;
  invoiceDate: string;
  dueDate: string | null;
  invoiceTotal: number;
  paid: number;
  outstanding: number;
  paymentStatus: InvoicePaymentStatus;
  isOverdue: boolean;
  daysOverdue: number | null;
  currency: string;
}

export interface ReceivablesSummaryDto {
  totalOutstanding: number;
  overdueAmount: number;
  partiallyPaidCount: number;
  dueThisMonthAmount: number;
  totalReceivablesCount: number;
}

export interface ReceivablesListResponseDto {
  summary: ReceivablesSummaryDto;
  items: ReceivableInvoiceDto[];
}

export interface ClientPaymentSummaryDto {
  clientId: string;
  clientName: string;
  totalInvoiced: number;
  totalPaid: number;
  outstanding: number;
}
