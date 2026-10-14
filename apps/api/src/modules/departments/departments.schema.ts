import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(100),
  code: z.string().trim().max(20).optional().nullable(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name cannot be empty').max(100).optional(),
  code: z.string().trim().max(20).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const departmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid department ID format'),
});

export const listDepartmentsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
