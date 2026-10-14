import { z } from 'zod';

export const createPositionSchema = z.object({
  name: z.string().trim().min(1, 'Position name is required').max(100),
});

export const updatePositionSchema = z.object({
  name: z.string().trim().min(1, 'Position name cannot be empty').max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const positionIdParamSchema = z.object({
  id: z.string().uuid('Invalid position ID format'),
});

export const listPositionsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
