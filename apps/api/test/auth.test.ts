import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/infrastructure/database/prisma';
import { hashPassword } from '../src/common/auth/token';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';

describe('Stage 4 — Authentication, Tenancy, and Authorization', () => {
  let companyAId: string;
  let companyBId: string;
  let suspendedCompanyId: string;

  let adminAUser: { id: string; email: string };
  let employeeAUser: { id: string; email: string };
  let multiUser: { id: string; email: string };
  let suspendedUser: { id: string; email: string };

  const rawPassword = 'Password123!';

  beforeAll(async () => {
    const passwordHash = await hashPassword(rawPassword);

    // Create companies
    const compA = await prisma.company.create({
      data: {
        name: 'Auth Test Acme',
        slug: `auth-test-acme-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Auth Test Globex',
        slug: `auth-test-globex-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    const compSuspended = await prisma.company.create({
      data: {
        name: 'Auth Test Suspended',
        slug: `auth-test-suspended-${Date.now()}`,
        status: CompanyStatus.SUSPENDED,
      },
    });
    suspendedCompanyId = compSuspended.id;

    // Create users
    const uAdminA = await prisma.user.create({
      data: {
        email: `admin.auth.${Date.now()}@example.com`,
        passwordHash,
        fullName: 'Admin User Acme',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.COMPANY_ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    adminAUser = { id: uAdminA.id, email: uAdminA.email };

    const uEmpA = await prisma.user.create({
      data: {
        email: `emp.auth.${Date.now()}@example.com`,
        passwordHash,
        fullName: 'Employee User Acme',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.EMPLOYEE,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    employeeAUser = { id: uEmpA.id, email: uEmpA.email };

    const uMulti = await prisma.user.create({
      data: {
        email: `multi.auth.${Date.now()}@example.com`,
        passwordHash,
        fullName: 'Multi Tenant User',
        status: UserStatus.ACTIVE,
        memberships: {
          create: [
            {
              companyId: companyAId,
              role: MembershipRole.EMPLOYEE,
              status: MembershipStatus.ACTIVE,
            },
            {
              companyId: companyBId,
              role: MembershipRole.HR_ADMIN,
              status: MembershipStatus.ACTIVE,
            },
          ],
        },
      },
    });
    multiUser = { id: uMulti.id, email: uMulti.email };

    const uSuspended = await prisma.user.create({
      data: {
        email: `suspended.auth.${Date.now()}@example.com`,
        passwordHash,
        fullName: 'Suspended User',
        status: UserStatus.SUSPENDED,
        memberships: {
          create: {
            companyId: companyAId,
            role: MembershipRole.EMPLOYEE,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    suspendedUser = { id: uSuspended.id, email: uSuspended.email };
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: {
        userId: { in: [adminAUser.id, employeeAUser.id, multiUser.id, suspendedUser.id] },
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        actorUserId: { in: [adminAUser.id, employeeAUser.id, multiUser.id, suspendedUser.id] },
      },
    });
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminAUser.id, employeeAUser.id, multiUser.id, suspendedUser.id] } },
    });
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in with valid credentials and returns tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.email).toBe(adminAUser.email);
      expect(res.body.data).toHaveProperty('tokens');
      expect(res.body.data.tokens).toHaveProperty('accessToken');
      expect(res.body.data.tokens).toHaveProperty('refreshToken');

      // Verify audit log recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: { actorUserId: adminAUser.id, action: 'AUTH_LOGIN' },
      });
      expect(auditLog).toBeDefined();
    });

    it('rejects login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects login for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: rawPassword });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects login for suspended user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: suspendedUser.email, password: rawPassword });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('validates request body via Zod', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'invalid-email', password: '' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token and issues a new access token', async () => {
      // Login first
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: employeeAUser.email, password: rawPassword });

      const initialRefreshToken = loginRes.body.data.tokens.refreshToken;

      // Refresh
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).not.toBe(initialRefreshToken);

      // Attempting to reuse old refresh token should fail
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('REVOKED_TOKEN');
    });

    it('rejects invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token-value' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('logs out and revokes the provided refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      const { accessToken, refreshToken } = loginRes.body.data.tokens;

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.data.message).toBe('Logged out successfully');

      // Refresh token can no longer be used
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns current user identity and memberships', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: multiUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.email).toBe(multiUser.email);
      expect(meRes.body.data.memberships.length).toBe(2);
      expect(meRes.body.data.activeCompany).toBeNull();
    });

    it('returns active company role and permissions when X-Company-Id header is passed', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: multiUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-company-id', companyBId);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.activeCompany).toBeDefined();
      expect(meRes.body.data.activeCompany.id).toBe(companyBId);
      expect(meRes.body.data.activeCompany.role).toBe(MembershipRole.HR_ADMIN);
      expect(meRes.body.data.activeCompany.permissions).toContain('leave.approve');
    });
  });

  describe('POST /api/v1/auth/active-company (Company Selection)', () => {
    it('allows multi-tenant user to select an active company', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: multiUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const switchRes = await request(app)
        .post('/api/v1/auth/active-company')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ companyId: companyAId });

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.data.activeCompany.id).toBe(companyAId);
      expect(switchRes.body.data.activeCompany.role).toBe(MembershipRole.EMPLOYEE);
      expect(switchRes.body.data.accessToken).toBeDefined();

      // Audit log check
      const audit = await prisma.auditLog.findFirst({
        where: {
          actorUserId: multiUser.id,
          action: 'COMPANY_SWITCH',
          companyId: companyAId,
        },
      });
      expect(audit).toBeDefined();
    });

    it('denies selecting a company where user has no membership', async () => {
      // Admin A has membership only in Company A
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const switchRes = await request(app)
        .post('/api/v1/auth/active-company')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ companyId: companyBId });

      expect(switchRes.status).toBe(403);
      expect(switchRes.body.error.code).toBe('FORBIDDEN');
    });

    it('denies selecting a suspended company', async () => {
      // Connect user to suspended company
      await prisma.companyMembership.create({
        data: {
          companyId: suspendedCompanyId,
          userId: employeeAUser.id,
          role: MembershipRole.EMPLOYEE,
          status: MembershipStatus.ACTIVE,
        },
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: employeeAUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const switchRes = await request(app)
        .post('/api/v1/auth/active-company')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ companyId: suspendedCompanyId });

      expect(switchRes.status).toBe(403);
      expect(switchRes.body.error.message).toContain('suspended');
    });
  });

  describe('Companies & Authorization Matrix', () => {
    it('GET /api/v1/companies lists only companies accessible to user', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const res = await request(app)
        .get('/api/v1/companies')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(companyAId);
    });

    it('GET /api/v1/companies/:companyId returns company details with valid permission', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      const res = await request(app)
        .get(`/api/v1/companies/${companyAId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-company-id', companyAId);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(companyAId);
    });

    it('GET /api/v1/companies/:companyId rejects cross-tenant lookup with 404', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminAUser.email, password: rawPassword });

      const { accessToken } = loginRes.body.data.tokens;

      // Caller is in Company A context, attempting to query Company B
      const res = await request(app)
        .get(`/api/v1/companies/${companyBId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-company-id', companyAId);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
