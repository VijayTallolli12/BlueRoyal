import { z } from 'zod';

export const recordPaymentSchema = z.object({
  clientId: z.string().uuid('Invalid client ID format'),
  invoiceId: z.string().uuid('Invalid invoice ID format'),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'paymentDate must follow YYYY-MM-DD format'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CARD', 'OTHER'], {
    errorMap: () => ({ message: 'paymentMethod must be one of BANK_TRANSFER, CHEQUE, CASH, CARD, OTHER' }),
  }),
  referenceNumber: z.string().max(100, 'referenceNumber must be under 100 characters').optional().nullable(),
  notes: z.string().max(1000, 'notes must be under 1000 characters').optional().nullable(),
});

export const reversePaymentSchema = z.object({
  reason: z
    .string({ required_error: 'A reversal reason is required' })
    .trim()
    .min(5, 'Reversal reason must be at least 5 characters long')
    .max(500, 'Reversal reason must not exceed 500 characters'),
});
