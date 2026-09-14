import { z } from 'zod';

export const generateInvoiceSchema = z.object({
  clientId: z.string().uuid('Invalid Client UUID format'),
  projectId: z.string().uuid('Invalid Project UUID format'),
  billingPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Billing period must match YYYY-MM format (e.g. 2026-08)'),
  designationId: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() !== '' ? val : undefined))
    .pipe(z.string().uuid('Invalid Designation UUID format').optional()),
  notes: z
    .string()
    .nullish()
    .transform((val) => (val && val.trim() !== '' ? val : undefined)),
});

export const rejectInvoiceSchema = z.object({
  reason: z.string().min(3, 'Rejection reason must be at least 3 characters'),
});
