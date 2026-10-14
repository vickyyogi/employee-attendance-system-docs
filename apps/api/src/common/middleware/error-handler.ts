import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error';
import { logger } from '../../infrastructure/logger/logger';
import type { ApiErrorResponse, ApiErrorDetail } from '@attendance/api-contracts';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

  // 1. Handled Domain AppError
  if (err instanceof AppError) {
    const errorResponse: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
        requestId,
      },
    };
    res.status(err.statusCode).json(errorResponse);
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const errorResponse: ApiErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
        requestId,
      },
    };
    res.status(422).json(errorResponse);
    return;
  }

  // 3. SyntaxError (malformed JSON payload)
  if (err instanceof SyntaxError && 'status' in err && (err as { status: unknown }).status === 400) {
    const errorResponse: ApiErrorResponse = {
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON payload in request body',
        requestId,
      },
    };
    res.status(400).json(errorResponse);
    return;
  }

  // 4. CORS error
  if (err instanceof Error && err.message.includes('CORS')) {
    const errorResponse: ApiErrorResponse = {
      error: {
        code: 'CORS_FORBIDDEN',
        message: err.message,
        requestId,
      },
    };
    res.status(403).json(errorResponse);
    return;
  }

  // 5. Unexpected Internal Server Error (never leak stack trace or internal details)
  logger.error('Unhandled internal server error', {
    requestId,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  const errorResponse: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      requestId,
    },
  };
  res.status(500).json(errorResponse);
}
