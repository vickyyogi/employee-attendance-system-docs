import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default('postgresql://attendance_app:local_dev_password@localhost:5432/attendance_dev'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim())),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_SECRET: z
    .string()
    .default('local-dev-insecure-auth-secret-minimum-32-characters-key'),
  AUTH_ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  AUTH_REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('storage/selfies'),
  STORAGE_SIGNED_URL_SECRET: z.string().optional(),
  STORAGE_UPLOAD_EXPIRY_SECONDS: z.coerce.number().int().positive().default(900),
  STORAGE_READ_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
  STORAGE_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`Environment validation failed: ${errorDetails}`);
  }
  return result.data;
}

export const env = loadEnv();
