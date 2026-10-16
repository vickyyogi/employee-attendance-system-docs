import { z } from 'zod';

export const createCorrectionRequestSchema = z.object({
  attendanceRecordId: z.string().uuid('Invalid attendance record ID').optional(),
  requestedCheckInAt: z.string().datetime({ offset: true }).optional(),
  requestedCheckOutAt: z.string().datetime({ offset: true }).optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500, 'Reason cannot exceed 500 characters'),
});

export const correctionDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500, 'Decision note cannot exceed 500 characters').optional(),
});

export const correctionIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
