import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  activeCompanySchema,
} from './auth.schema';
import type { ApiResponse } from '@attendance/api-contracts';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      const result = await authService.login(input, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId,
      });

      const response: ApiResponse<typeof result> = {
        data: result,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      const tokens = await authService.refreshTokens(refreshToken);

      const response: ApiResponse<{ tokens: typeof tokens }> = {
        data: { tokens },
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = logoutSchema.parse(req.body);
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      if (!req.user) {
        res.status(200).json({ data: { message: 'Logged out' }, meta: { requestId } });
        return;
      }

      await authService.logout(req.user.id, refreshToken, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId,
      });

      const response: ApiResponse<{ message: string }> = {
        data: { message: 'Logged out successfully' },
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const activeCompanyId =
        (req.headers['x-company-id'] as string) || req.tenantContext?.companyId;

      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId } });
        return;
      }

      const result = await authService.getMe(req.user.id, activeCompanyId);

      const response: ApiResponse<typeof result> = {
        data: result,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async selectActiveCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = activeCompanySchema.parse(req.body);
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';

      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated', requestId } });
        return;
      }

      const result = await authService.selectActiveCompany(req.user.id, companyId, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        requestId,
      });

      const response: ApiResponse<typeof result> = {
        data: result,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
