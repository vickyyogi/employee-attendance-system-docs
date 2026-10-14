import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createShiftSchema = z.object({
  name: z.string().trim().min(1, 'Shift name is required').max(100),
  startTimeLocal: z.string().regex(timeRegex, 'Start time must be in HH:mm format (24-hour)'),
  endTimeLocal: z.string().regex(timeRegex, 'End time must be in HH:mm format (24-hour)'),
  crossesMidnight: z.boolean().optional(),
  gracePeriodMinutes: z.coerce.number().int().min(0, 'Grace period minutes must be non-negative').optional().default(15),
  isActive: z.boolean().optional().default(true),
});

export const updateShiftSchema = z.object({
  name: z.string().trim().min(1, 'Shift name cannot be empty').max(100).optional(),
  startTimeLocal: z.string().regex(timeRegex, 'Start time must be in HH:mm format (24-hour)').optional(),
  endTimeLocal: z.string().regex(timeRegex, 'End time must be in HH:mm format (24-hour)').optional(),
  crossesMidnight: z.boolean().optional(),
  gracePeriodMinutes: z.coerce.number().int().min(0, 'Grace period minutes must be non-negative').optional(),
  isActive: z.boolean().optional(),
});

export const shiftIdParamSchema = z.object({
  id: z.string().uuid('Invalid shift ID format'),
});

export const listShiftsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
