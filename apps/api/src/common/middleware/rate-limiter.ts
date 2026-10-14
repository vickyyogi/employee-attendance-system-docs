import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../../config/env';
import type { ApiErrorResponse } from '@attendance/api-contracts';

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  skipInTest?: boolean;
}

export function createRateLimiter(options?: RateLimiterOptions): RateLimitRequestHandler {
  const windowMs = options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = options?.max ?? env.RATE_LIMIT_MAX;
  const message = options?.message ?? 'Too many requests, please try again later';
  const skipInTest = options?.skipInTest ?? true;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => skipInTest && env.NODE_ENV === 'test',
    handler: (req, res) => {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const errorResponse: ApiErrorResponse = {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          requestId,
        },
      };
      res.status(429).json(errorResponse);
    },
  });
}

export const globalRateLimiter = createRateLimiter();
