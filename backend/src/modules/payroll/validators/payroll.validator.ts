import { z } from 'zod';

export const createPayrollPeriodSchema = z.object({
  attendancePeriodId: z.string().uuid({ message: 'Valid attendancePeriodId UUID is required' }),
  periodCode: z
    .string()
    .regex(/^\d{4}-\d{2}$/, { message: 'periodCode must follow format YYYY-MM (e.g. 2026-05)' })
    .optional(),
  name: z.string().min(3).max(100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must follow format YYYY-MM-DD' }).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must follow format YYYY-MM-DD' }).optional(),
  notes: z.string().max(500).optional(),
});

export const addPayrollAdjustmentSchema = z.object({
  adjustmentType: z.enum(['addition', 'deduction'], {
    message: "adjustmentType must be either 'addition' or 'deduction'",
  }),
  amount: z.number().positive({ message: 'Adjustment amount must be strictly greater than 0' }),
  description: z.string().min(5, { message: 'Description must be at least 5 characters detailing reason' }),
});

export const unlockPayrollPeriodSchema = z.object({
  reason: z.string().min(15, { message: 'Unlock reason must be at least 15 characters long detailing audit justification' }),
});
