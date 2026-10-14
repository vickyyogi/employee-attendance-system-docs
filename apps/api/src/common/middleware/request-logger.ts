import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logger/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = req.requestId || (req.headers['x-request-id'] as string) || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('HTTP Request Completed', {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent']?.substring(0, 100),
    });
  });

  next();
}
