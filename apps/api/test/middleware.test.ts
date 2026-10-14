import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { app } from '../src/app';
import { requestIdMiddleware } from '../src/common/middleware/request-id';
import { errorHandler } from '../src/common/middleware/error-handler';
import { createRateLimiter } from '../src/common/middleware/rate-limiter';
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../src/common/errors/app-error';

describe('Backend Foundation Middleware', () => {
  describe('Request ID Middleware', () => {
    it('generates a new UUID if x-request-id header is not provided', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
      expect(res.body.meta.requestId).toBe(res.headers['x-request-id']);
    });

    it('preserves client-provided x-request-id header', async () => {
      const customId = 'client-test-req-id-12345';
      const res = await request(app)
        .get('/api/v1/health')
        .set('x-request-id', customId);

      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body.meta.requestId).toBe(customId);
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('includes standard security headers', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('CORS Policy', () => {
    it('allows requests from allowed origins', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('rejects requests from disallowed origins', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://malicious-website.com');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error.code).toBe('CORS_FORBIDDEN');
    });
  });

  describe('404 Not Found Handler', () => {
    it('returns standard error envelope with NOT_FOUND code for unknown routes', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Cannot GET /api/v1/non-existent-endpoint',
          requestId: expect.any(String),
        },
      });
    });
  });

  describe('Centralized Error Handler', () => {
    function setupErrorTestApp() {
      const testApp = express();
      testApp.use(express.json());
      testApp.use(requestIdMiddleware);

      testApp.get('/bad-request', () => {
        throw new BadRequestError('Invalid query parameters');
      });

      testApp.get('/unauthorized', () => {
        throw new UnauthorizedError('Token expired');
      });

      testApp.get('/forbidden', () => {
        throw new ForbiddenError('Tenant permission denied');
      });

      testApp.get('/conflict', () => {
        throw new ConflictError('Attendance record already exists for today');
      });

      testApp.get('/validation-error', () => {
        throw new ValidationError('Validation failed', [
          { field: 'email', message: 'Invalid email address', code: 'invalid_string' },
        ]);
      });

      testApp.post('/zod-validation', (req) => {
        const schema = z.object({
          companySlug: z.string().min(3),
          employeeNumber: z.number().int().positive(),
        });
        schema.parse(req.body);
      });

      testApp.get('/unhandled-error', () => {
        throw new Error('Database connection failed abruptly');
      });

      testApp.use(errorHandler);
      return testApp;
    }

    const testApp = setupErrorTestApp();

    it('formats BadRequestError with 400', async () => {
      const res = await request(testApp).get('/bad-request');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toBe('Invalid query parameters');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('formats UnauthorizedError with 401', async () => {
      const res = await request(testApp).get('/unauthorized');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('Token expired');
    });

    it('formats ForbiddenError with 403', async () => {
      const res = await request(testApp).get('/forbidden');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Tenant permission denied');
    });

    it('formats ConflictError with 409', async () => {
      const res = await request(testApp).get('/conflict');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('Attendance record already exists for today');
    });

    it('formats ValidationError with 422 and details', async () => {
      const res = await request(testApp).get('/validation-error');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveLength(1);
      expect(res.body.error.details[0].field).toBe('email');
    });

    it('formats ZodError with 422 and parsed issues', async () => {
      const res = await request(testApp)
        .post('/zod-validation')
        .send({ companySlug: 'a', employeeNumber: -5 });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
    });

    it('handles malformed JSON syntax errors with 400 INVALID_JSON', async () => {
      const res = await request(testApp)
        .post('/zod-validation')
        .set('Content-Type', 'application/json')
        .send('{ "invalidJson": ');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_JSON');
    });

    it('formats unexpected errors as 500 INTERNAL_SERVER_ERROR without leaking internal message or stack trace', async () => {
      const res = await request(testApp).get('/unhandled-error');

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBe('Internal server error');
      // Verify no stack trace or raw database error details leaked
      expect(res.body.error).not.toHaveProperty('stack');
      expect(res.body.error.message).not.toContain('Database connection failed');
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('Rate Limiter Middleware', () => {
    it('blocks requests exceeding maximum allowance and returns 429 standard envelope', async () => {
      const rateLimitApp = express();
      rateLimitApp.use(requestIdMiddleware);
      rateLimitApp.use(
        createRateLimiter({
          windowMs: 60000,
          max: 2,
          skipInTest: false,
          message: 'Too many test requests',
        })
      );
      rateLimitApp.get('/test-rate-limit', (_req, res) => {
        res.status(200).json({ ok: true });
      });

      // Request 1: OK
      const res1 = await request(rateLimitApp).get('/test-rate-limit');
      expect(res1.status).toBe(200);

      // Request 2: OK
      const res2 = await request(rateLimitApp).get('/test-rate-limit');
      expect(res2.status).toBe(200);

      // Request 3: Rate limited -> 429
      const res3 = await request(rateLimitApp).get('/test-rate-limit');
      expect(res3.status).toBe(429);
      expect(res3.body).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many test requests',
          requestId: expect.any(String),
        },
      });
    });
  });
});
