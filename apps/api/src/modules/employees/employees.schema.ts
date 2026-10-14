import { z } from 'zod';

export const createEmployeeSchema = z.object({
  employeeNumber: z.string().trim().min(1, 'Employee number is required').max(50),
  fullName: z.string().trim().min(1, 'Full name is required').max(150),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  positionId: z.string().uuid('Invalid position ID').optional().nullable(),
  managerEmployeeId: z.string().uuid('Invalid manager ID').optional().nullable(),
  userId: z.string().uuid('Invalid user ID').optional().nullable(),
  hireDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid hire date format',
    }),
});

export const updateEmployeeSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name cannot be empty').max(150).optional(),
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  departmentId: z.string().uuid('Invalid department ID').optional().nullable(),
  positionId: z.string().uuid('Invalid position ID').optional().nullable(),
  managerEmployeeId: z.string().uuid('Invalid manager ID').optional().nullable(),
  hireDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid hire date format',
    }),
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED'], {
    errorMap: () => ({ message: 'Status must be ACTIVE, INACTIVE, or TERMINATED' }),
  }),
  terminationDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid termination date format',
    }),
});

export const employeeIdParamSchema = z.object({
  id: z.string().uuid('Invalid employee ID format'),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  departmentId: z.string().uuid('Invalid department ID').optional(),
  positionId: z.string().uuid('Invalid position ID').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateEmployeeStatusInput = z.infer<typeof updateEmployeeStatusSchema>;
export type ListEmployeesQueryInput = z.infer<typeof listEmployeesQuerySchema>;
