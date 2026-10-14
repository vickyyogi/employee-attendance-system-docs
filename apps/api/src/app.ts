import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { requestIdMiddleware } from './common/middleware/request-id';
import { requestLogger } from './common/middleware/request-logger';
import { globalRateLimiter } from './common/middleware/rate-limiter';
import { notFoundHandler } from './common/middleware/not-found-handler';
import { errorHandler } from './common/middleware/error-handler';
import { v1Router } from './routes/v1.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS configuration with whitelist check
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (mobile, curl, server-to-server) with no origin
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request ID & Logging
app.use(requestIdMiddleware);
app.use(requestLogger);

// Global Rate Limiting
app.use(globalRateLimiter);

// API v1 Router
app.use('/api/v1', v1Router);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export { app };
export default app;
