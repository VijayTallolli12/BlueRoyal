import { z } from 'zod';

export const generateInvoiceSchema = z.object({
  clientId: z.string().uuid('Invalid Client UUID format'),
  projectId: z.string().uuid('Invalid Project UUID format'),
  billingPeriod: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Billing period must match YYYY-MM format (e.g. 2026-08)'),
  notes: z.string().optional(),
});
