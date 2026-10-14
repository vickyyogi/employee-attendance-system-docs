import { z } from 'zod';

export const createWorkLocationSchema = z.object({
  name: z.string().trim().min(1, 'Location name is required').max(100),
  address: z.string().trim().max(255).optional().nullable(),
  latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  geofenceRadiusM: z.coerce.number().int().min(1, 'Geofence radius must be greater than 0').optional().default(100),
  maxGpsAccuracyM: z.coerce.number().int().min(1, 'Maximum GPS accuracy must be greater than 0').optional().default(50),
  isActive: z.boolean().optional().default(true),
});

export const updateWorkLocationSchema = z.object({
  name: z.string().trim().min(1, 'Location name cannot be empty').max(100).optional(),
  address: z.string().trim().max(255).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geofenceRadiusM: z.coerce.number().int().min(1).optional(),
  maxGpsAccuracyM: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const workLocationIdParamSchema = z.object({
  id: z.string().uuid('Invalid work location ID format'),
});

export const listWorkLocationsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type CreateWorkLocationInput = z.infer<typeof createWorkLocationSchema>;
export type UpdateWorkLocationInput = z.infer<typeof updateWorkLocationSchema>;
