import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/token';
import { prisma } from '../../infrastructure/database/prisma';
import { validateMembership, TenantContext } from '../../infrastructure/database/tenant-context';
import { hasPermission } from '../auth/permissions';
import { UnauthorizedError, ForbiddenError, BadRequestError } from '../errors/app-error';
import { UserStatus } from '@prisma/client';
import type { PermissionKey } from '@attendance/api-contracts';

export interface RequestUser {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: RequestUser;
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Authenticates requests using Bearer access token.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      throw new UnauthorizedError('Token not provided');
    }

    const payload = verifyAccessToken(token);

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('User account is suspended or no longer exists');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates and attaches TenantContext to request.
 * Company ID is resolved from X-Company-Id header or URL param.
 */
export async function requireTenantContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required before tenant selection');
    }

    const companyId =
      (req.headers['x-company-id'] as string) ||
      (req.params.companyId as string) ||
      (req.query.companyId as string);

    if (!companyId || typeof companyId !== 'string' || companyId.trim().length === 0) {
      throw new BadRequestError('Tenant context required: provide X-Company-Id header');
    }

    const tenantContext = await validateMembership(req.user.id, companyId.trim());
    req.tenantContext = tenantContext;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Enforces permission check based on active tenant role.
 */
export function requirePermission(permission: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenantContext) {
      return next(
        new ForbiddenError('Tenant context must be established before checking permissions')
      );
    }

    if (!hasPermission(req.tenantContext.role, permission)) {
      return next(new ForbiddenError(`Permission denied: '${permission}' required`));
    }

    next();
  };
}
