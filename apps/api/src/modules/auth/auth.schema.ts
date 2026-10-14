import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export const activeCompanySchema = z.object({
  companyId: z.string().uuid('Invalid company ID format'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ActiveCompanyInput = z.infer<typeof activeCompanySchema>;
