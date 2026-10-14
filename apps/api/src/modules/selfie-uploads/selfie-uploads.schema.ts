import { z } from 'zod';

export const createSelfieIntentSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'], {
    errorMap: () => ({ message: "mimeType must be one of 'image/jpeg', 'image/png', 'image/webp'" }),
  }),
  originalName: z.string().max(255).optional(),
  fileSizeBytes: z
    .number()
    .int()
    .positive('fileSizeBytes must be a positive integer')
    .max(5 * 1024 * 1024, 'fileSizeBytes cannot exceed 5MB (5,242,880 bytes)')
    .optional(),
});

export const selfieIdParamSchema = z.object({
  id: z.string().uuid('Invalid selfie upload ID format'),
});

export type CreateSelfieIntentInput = z.infer<typeof createSelfieIntentSchema>;
