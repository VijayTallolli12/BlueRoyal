export type InvoiceStatus = 'draft' | 'issued';

export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  employeeId?: string | null;
  employee?: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  projectId: string;
  projectName?: string | null;
  description: string;
  hours: number;
  overtimeHours: number;
  rate: number;
  otRate: number;
  amount: number;
  lineType: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  clientId: string;
  client?: { id: string; name: string; code?: string };
  clientName?: string;
  clientCode?: string;
  projectId: string;
  project?: { id: string; name: string; code?: string };
  projectName?: string;
  projectCode?: string;
  billingPeriod: string;
  invoiceDate: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  notes?: string | null;
  issuedAt?: string | null;
  issuedBy?: string | null;
  lines?: InvoiceLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerateInvoiceDto {
  clientId: string;
  projectId: string;
  billingPeriod: string; // "YYYY-MM"
  notes?: string;
}

export interface InvoicePreviewItemDto {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designationTitle: string;
  regularHours: number;
  otHours: number;
  regularRate: number;
  otRate: number;
  regularAmount: number;
  otAmount: number;
  totalAmount: number;
}

export interface InvoicePreviewDto {
  clientId: string;
  clientName: string;
  projectId: string;
  projectName: string;
  billingPeriod: string;
  billableEmployeesCount: number;
  totalRegularHours: number;
  totalOtHours: number;
  regularRate: number;
  otRate: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  taxNotice: string;
  items: InvoicePreviewItemDto[];
}
