import { z } from 'zod';

export const createPeriodSchema = z.object({
  periodCode: z.string().regex(/^\d{4}-\d{2}$/, 'periodCode must follow format YYYY-MM (e.g. 2026-05)'),
  name: z.string().min(1).max(64).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
});

export const batchUpdateRecordItemSchema = z.object({
  recordId: z.string().uuid(),
  actualHours: z.number().min(0).max(24).optional(),
  isOnLeave: z.boolean().optional(),
  remarks: z.string().max(255).optional(),
  changeReason: z.string().min(3, 'changeReason must be at least 3 characters').optional(),
});

export const batchUpdateSchema = z.object({
  batchReason: z.string().min(3).optional(),
  records: z.array(batchUpdateRecordItemSchema).min(1, 'At least one record must be provided for update'),
});

export const unlockPeriodSchema = z.object({
  reason: z.string().min(15, 'Unlock reason must be at least 15 characters long detailing the audit justification'),
});

export const getGridQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  hasAnomaly: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    }),
});
