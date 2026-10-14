import { z } from 'zod';

export const createEmployeeShiftSchema = z
  .object({
    employeeId: z.string().uuid('Invalid employee ID format'),
    shiftId: z.string().uuid('Invalid shift ID format'),
    effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'effectiveFrom must be a valid date',
    }),
    effectiveTo: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'effectiveTo must be a valid date',
      }),
  })
  .refine(
    (data) => {
      if (!data.effectiveTo) return true;
      return new Date(data.effectiveTo) >= new Date(data.effectiveFrom);
    },
    {
      message: 'effectiveTo cannot be earlier than effectiveFrom',
      path: ['effectiveTo'],
    }
  );

export const employeeShiftIdParamSchema = z.object({
  id: z.string().uuid('Invalid employee shift assignment ID format'),
});

export const listEmployeeShiftsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  effectiveDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'effectiveDate must be a valid date',
    }),
});

export type CreateEmployeeShiftInput = z.infer<typeof createEmployeeShiftSchema>;
export type ListEmployeeShiftsQueryInput = z.infer<typeof listEmployeeShiftsQuerySchema>;
