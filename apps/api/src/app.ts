import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { ApiResponse, HealthCheckData, ApiErrorResponse } from '@attendance/api-contracts';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();
  res.setHeader('x-request-id', requestId);
  req.headers['x-request-id'] = requestId;
  next();
});

// Health check endpoint
app.get('/api/v1/health', (_req: Request, res: Response) => {
  const requestId = res.getHeader('x-request-id') as string;
  const response: ApiResponse<HealthCheckData> = {
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
    },
    meta: {
      requestId,
    },
  };
  res.status(200).json(response);
});

// 404 Handler
app.use((req: Request, res: Response) => {
  const requestId = res.getHeader('x-request-id') as string;
  const errorResponse: ApiErrorResponse = {
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      requestId,
    },
  };
  res.status(404).json(errorResponse);
});

export { app };
export default app;
