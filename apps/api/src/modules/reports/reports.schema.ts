import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const attendanceSummaryQuerySchema = z
  .object({
    startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format'),
    endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format'),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['endDate'],
  });

export const lateArrivalsQuerySchema = z
  .object({
    startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format'),
    endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format'),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 100)),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['endDate'],
  });

export const attendanceExportSchema = z
  .object({
    startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format'),
    endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format'),
    format: z.enum(['csv', 'json']).default('csv'),
    departmentId: z.string().uuid().optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: 'startDate must be less than or equal to endDate',
    path: ['endDate'],
  });

export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
export type LateArrivalsQuery = z.infer<typeof lateArrivalsQuerySchema>;
export type AttendanceExportInput = z.infer<typeof attendanceExportSchema>;
