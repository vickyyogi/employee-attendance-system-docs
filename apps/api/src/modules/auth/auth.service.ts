import { prisma } from '../../infrastructure/database/prisma';
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from '../../common/auth/token';
import { validateMembership } from '../../infrastructure/database/tenant-context';
import { ROLE_PERMISSIONS } from '../../common/auth/permissions';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import { UnauthorizedError, ForbiddenError } from '../../common/errors/app-error';
import { UserStatus, MembershipStatus, CompanyStatus } from '@prisma/client';
import { env } from '../../config/env';
import type { LoginInput } from './auth.schema';
import type { AuthTokens, AuthMeResponseData } from '@attendance/api-contracts';

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export class AuthService {
  async login(
    input: LoginInput,
    meta: RequestMetadata = {}
  ): Promise<{
    user: { id: string; email: string; fullName: string; status: UserStatus };
    tokens: AuthTokens;
  }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          where: { status: MembershipStatus.ACTIVE },
          include: { company: true },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User account is suspended');
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken();

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Audit log
    await recordAuditLog({
      actorUserId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      metadata: { email: user.email },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: env.AUTH_ACCESS_TOKEN_EXPIRY,
      },
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(refreshToken);

    const record = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    if (record.revokedAt) {
      // Token reuse detected - revoke all descendant tokens for security
      throw new UnauthorizedError('Refresh token has already been revoked', 'REVOKED_TOKEN');
    }

    if (new Date() > record.expiresAt) {
      throw new UnauthorizedError('Refresh token expired', 'EXPIRED_REFRESH_TOKEN');
    }

    if (record.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('User account is suspended');
    }

    // Rotate refresh token
    const newTokens = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: record.id },
        data: {
          revokedAt: new Date(),
          replacedBy: newTokens.tokenHash,
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: newTokens.tokenHash,
          expiresAt: newTokens.expiresAt,
        },
      }),
    ]);

    const newAccessToken = generateAccessToken({
      userId: record.user.id,
      email: record.user.email,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newTokens.token,
      expiresIn: env.AUTH_ACCESS_TOKEN_EXPIRY,
    };
  }

  async logout(
    userId: string,
    refreshToken?: string,
    meta: RequestMetadata = {}
  ): Promise<void> {
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, userId },
        data: { revokedAt: new Date() },
      });
    }

    await recordAuditLog({
      actorUserId: userId,
      action: 'AUTH_LOGOUT',
      entityType: 'User',
      entityId: userId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  async getMe(userId: string, activeCompanyId?: string): Promise<AuthMeResponseData> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: {
            status: MembershipStatus.ACTIVE,
            company: { status: CompanyStatus.ACTIVE },
          },
          include: {
            company: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    const memberships = user.memberships.map((m) => ({
      id: m.id,
      companyId: m.companyId,
      companyName: m.company.name,
      companySlug: m.company.slug,
      role: m.role,
      status: m.status,
    }));

    let activeCompany = null;
    if (activeCompanyId) {
      const selectedMembership = user.memberships.find(
        (m) => m.companyId === activeCompanyId
      );
      if (selectedMembership) {
        activeCompany = {
          id: selectedMembership.company.id,
          name: selectedMembership.company.name,
          slug: selectedMembership.company.slug,
          role: selectedMembership.role,
          permissions: [...ROLE_PERMISSIONS[selectedMembership.role]],
        };
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
      },
      memberships,
      activeCompany,
    };
  }

  async selectActiveCompany(
    userId: string,
    companyId: string,
    meta: RequestMetadata = {}
  ) {
    const tenantContext = await validateMembership(userId, companyId);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new ForbiddenError('Company not found');
    }

    const accessToken = generateAccessToken({
      userId,
      email: (await prisma.user.findUnique({ where: { id: userId } }))?.email || '',
      companyId,
    });

    await recordAuditLog({
      companyId,
      actorUserId: userId,
      action: 'COMPANY_SWITCH',
      entityType: 'Company',
      entityId: companyId,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
      metadata: { role: tenantContext.role },
    });

    return {
      activeCompany: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        role: tenantContext.role,
        permissions: [...ROLE_PERMISSIONS[tenantContext.role]],
      },
      accessToken,
    };
  }
}

export const authService = new AuthService();
