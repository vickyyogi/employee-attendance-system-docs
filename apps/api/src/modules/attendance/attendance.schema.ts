import { z } from 'zod';

export const checkInSchema = z.object({
  workLocationId: z.string().uuid('workLocationId must be a valid UUID'),
  latitude: z
    .number()
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180'),
  accuracyM: z
    .number()
    .int()
    .positive('accuracyM must be a positive integer'),
  selfieUploadId: z.string().uuid('selfieUploadId must be a valid UUID'),
  idempotencyKey: z
    .string()
    .min(1, 'idempotencyKey is required')
    .max(128, 'idempotencyKey cannot exceed 128 characters'),
});

export const checkOutSchema = z.object({
  latitude: z
    .number()
    .min(-90, 'latitude must be between -90 and 90')
    .max(90, 'latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'longitude must be between -180 and 180')
    .max(180, 'longitude must be between -180 and 180'),
  accuracyM: z
    .number()
    .int()
    .positive('accuracyM must be a positive integer'),
  selfieUploadId: z.string().uuid('selfieUploadId must be a valid UUID').optional(),
  workLocationId: z.string().uuid('workLocationId must be a valid UUID').optional(),
  idempotencyKey: z
    .string()
    .min(1, 'idempotencyKey is required')
    .max(128, 'idempotencyKey cannot exceed 128 characters'),
});

export const flagAttendanceSchema = z.object({
  reason: z
    .string()
    .min(3, 'Reason must be at least 3 characters long')
    .max(500, 'Reason cannot exceed 500 characters'),
});

export const attendanceIdParamSchema = z.object({
  id: z.string().uuid('Invalid attendance record ID format'),
});

export const attendanceSelfieParamSchema = z.object({
  id: z.string().uuid('Invalid attendance record ID format'),
  kind: z.enum(['check_in', 'check_out'], {
    errorMap: () => ({ message: "kind must be 'check_in' or 'check_out'" }),
  }),
});

export const listAttendanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  workLocationId: z.string().uuid().optional(),
  status: z
    .enum(['IN_PROGRESS', 'PRESENT', 'LATE', 'FLAGGED', 'CORRECTED'])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in format YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in format YYYY-MM-DD')
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type FlagAttendanceInput = z.infer<typeof flagAttendanceSchema>;
export type ListAttendanceQueryInput = z.infer<typeof listAttendanceQuerySchema>;
