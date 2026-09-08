import { z } from 'zod';

export const createLeaveTypeSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(32, 'Code cannot exceed 32 characters')
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional(),
  isPaid: z.boolean().optional(),
  defaultDaysPerYear: z.number().min(0).max(365).optional(),
  requiresAttachment: z.boolean().optional(),
  deductWorkingDaysOnly: z.boolean().optional(),
  allowDuringProbation: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  isPaid: z.boolean().optional(),
  defaultDaysPerYear: z.number().min(0).max(365).optional(),
  requiresAttachment: z.boolean().optional(),
  deductWorkingDaysOnly: z.boolean().optional(),
  allowDuringProbation: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const allocateLeaveBalanceSchema = z.object({
  employeeId: z.string().uuid('Valid employee UUID required'),
  leaveTypeId: z.string().uuid('Valid leave type UUID required'),
  year: z.number().int().min(2000).max(2100),
  allocatedDays: z.number().min(0, 'Allocated days cannot be negative').max(365),
  carriedForward: z.number().min(0).max(365).optional(),
  notes: z.string().optional(),
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid('Valid employee UUID required').optional(),
  leaveTypeId: z.string().uuid('Valid leave type UUID required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  attachmentUrl: z.string().optional(),
});

export const rejectLeaveRequestSchema = z.object({
  rejectionReason: z.string().min(5, 'Rejection reason must be at least 5 characters'),
});

export const cancelLeaveRequestSchema = z.object({
  cancellationReason: z.string().optional(),
});
