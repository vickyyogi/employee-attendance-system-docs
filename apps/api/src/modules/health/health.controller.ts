import { Request, Response } from 'express';
import { env } from '../../config/env';
import type { ApiResponse, HealthCheckData } from '@attendance/api-contracts';

export function getHealth(req: Request, res: Response): void {
  const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

  const response: ApiResponse<HealthCheckData> = {
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
    },
    meta: {
      requestId,
    },
  };

  res.status(200).json(response);
}
