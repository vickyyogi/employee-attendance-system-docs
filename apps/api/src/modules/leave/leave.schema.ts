import { z } from 'zod';

export const leaveUnitSchema = z.enum(['DAYS', 'HOURS']);

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  unit: leaveUnitSchema.optional().default('DAYS'),
  requiresApproval: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: leaveUnitSchema.optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const createLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid('Invalid leave type ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason cannot exceed 500 characters'),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500, 'Decision note cannot exceed 500 characters').optional(),
});

export const leaveIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
