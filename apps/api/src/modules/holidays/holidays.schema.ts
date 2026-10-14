import { z } from 'zod';

export const createHolidaySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Holiday date must be a valid date (YYYY-MM-DD)',
  }),
  name: z.string().trim().min(1, 'Holiday name is required').max(100),
});

export const updateHolidaySchema = z.object({
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Holiday date must be a valid date (YYYY-MM-DD)',
    })
    .optional(),
  name: z.string().trim().min(1, 'Holiday name cannot be empty').max(100).optional(),
});

export const holidayIdParamSchema = z.object({
  id: z.string().uuid('Invalid holiday ID format'),
});

export const listHolidaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
