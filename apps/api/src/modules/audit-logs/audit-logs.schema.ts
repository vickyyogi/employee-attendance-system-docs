import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const auditLogsQuerySchema = z.object({
  action: z.string().optional(),
  actorUserId: z.string().uuid().optional(),
  startDate: z.string().regex(dateRegex, 'startDate must be in YYYY-MM-DD format').optional(),
  endDate: z.string().regex(dateRegex, 'endDate must be in YYYY-MM-DD format').optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
