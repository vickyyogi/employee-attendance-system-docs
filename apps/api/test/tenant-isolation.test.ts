import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/infrastructure/database/prisma';
import {
  validateMembership,
  createTenantScope,
  assertTenantOwnership,
} from '../src/infrastructure/database/tenant-context';
import { ForbiddenError, NotFoundError } from '../src/common/errors/app-error';
import { MembershipRole, MembershipStatus, UserStatus, CompanyStatus } from '@prisma/client';

describe('Stage 3 — Prisma Schema and Tenant Isolation', () => {
  let companyAId: string;
  let companyBId: string;
  let userAdminAId: string;
  let userEmployeeAId: string;
  let userAdminBId: string;
  let userMultiId: string;
  let suspendedUserId: string;
  let suspendedCompanyId: string;

  beforeAll(async () => {
    // Setup isolated test companies
    const compA = await prisma.company.create({
      data: {
        name: 'Test Tenant A',
        slug: `test-tenant-a-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyAId = compA.id;

    const compB = await prisma.company.create({
      data: {
        name: 'Test Tenant B',
        slug: `test-tenant-b-${Date.now()}`,
        status: CompanyStatus.ACTIVE,
      },
    });
    companyBId = compB.id;

    const suspendedComp = await prisma.company.create({
      data: {
        name: 'Suspended Tenant',
        slug: `suspended-tenant-${Date.now()}`,
        status: CompanyStatus.SUSPENDED,
      },
    });
    suspendedCompanyId = suspendedComp.id;

    // Users
    const userA = await prisma.user.create({
      data: {
        email: `admin.a.${Date.now()}@test.com`,
        fullName: 'Admin A',
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
    userAdminAId = userA.id;

    const userEmpA = await prisma.user.create({
      data: {
        email: `emp.a.${Date.now()}@test.com`,
        fullName: 'Employee A',
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
    userEmployeeAId = userEmpA.id;

    const userB = await prisma.user.create({
      data: {
        email: `admin.b.${Date.now()}@test.com`,
        fullName: 'Admin B',
        status: UserStatus.ACTIVE,
        memberships: {
          create: {
            companyId: companyBId,
            role: MembershipRole.COMPANY_ADMIN,
            status: MembershipStatus.ACTIVE,
          },
        },
      },
    });
    userAdminBId = userB.id;

    const multi = await prisma.user.create({
      data: {
        email: `multi.${Date.now()}@test.com`,
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
    userMultiId = multi.id;

    const suspendedUser = await prisma.user.create({
      data: {
        email: `suspended.${Date.now()}@test.com`,
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
    suspendedUserId = suspendedUser.id;

    // Membership in suspended company
    await prisma.companyMembership.create({
      data: {
        companyId: suspendedCompanyId,
        userId: userAdminAId,
        role: MembershipRole.COMPANY_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.companyMembership.deleteMany({
      where: { companyId: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.department.deleteMany({
      where: { companyId: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.position.deleteMany({
      where: { companyId: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyAId, companyBId, suspendedCompanyId] } },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [userAdminAId, userEmployeeAId, userAdminBId, userMultiId, suspendedUserId],
        },
      },
    });
    await prisma.$disconnect();
  });

  describe('Tenant Context & Membership Validation', () => {
    it('validates active user in active tenant and returns TenantContext', async () => {
      const context = await validateMembership(userAdminAId, companyAId);

      expect(context).toBeDefined();
      expect(context.companyId).toBe(companyAId);
      expect(context.userId).toBe(userAdminAId);
      expect(context.role).toBe(MembershipRole.COMPANY_ADMIN);
      expect(context.membershipId).toBeDefined();
    });

    it('denies access if user has no membership in the tenant', async () => {
      // User Admin A tries to access Company B
      await expect(validateMembership(userAdminAId, companyBId)).rejects.toThrow(ForbiddenError);
    });

    it('denies access if user account is suspended', async () => {
      await expect(validateMembership(suspendedUserId, companyAId)).rejects.toThrow(
        /User account is not active/
      );
    });

    it('denies access if company tenant is suspended', async () => {
      await expect(validateMembership(userAdminAId, suspendedCompanyId)).rejects.toThrow(
        /Company tenant is suspended or inactive/
      );
    });

    it('supports multi-tenant user switching between company memberships', async () => {
      // User is Employee in Company A
      const contextA = await validateMembership(userMultiId, companyAId);
      expect(contextA.companyId).toBe(companyAId);
      expect(contextA.role).toBe(MembershipRole.EMPLOYEE);

      // Same User is HR_ADMIN in Company B
      const contextB = await validateMembership(userMultiId, companyBId);
      expect(contextB.companyId).toBe(companyBId);
      expect(contextB.role).toBe(MembershipRole.HR_ADMIN);
    });
  });

  describe('Tenant Scoping & Resource Isolation', () => {
    it('enforces same department names can exist across different companies', async () => {
      const scopeA = createTenantScope({
        companyId: companyAId,
        userId: userAdminAId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-a',
      });

      const scopeB = createTenantScope({
        companyId: companyBId,
        userId: userAdminBId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-b',
      });

      // Both companies create an "Engineering" department
      const deptA = await scopeA.departments.create({ name: 'Engineering', code: 'ENG' });
      const deptB = await scopeB.departments.create({ name: 'Engineering', code: 'ENG' });

      expect(deptA.companyId).toBe(companyAId);
      expect(deptB.companyId).toBe(companyBId);
      expect(deptA.name).toBe('Engineering');
      expect(deptB.name).toBe('Engineering');
    });

    it('enforces unique department name within the same company', async () => {
      const scopeA = createTenantScope({
        companyId: companyAId,
        userId: userAdminAId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-a',
      });

      // Attempting duplicate department in company A should throw constraint violation
      await expect(scopeA.departments.create({ name: 'Engineering' })).rejects.toThrow();
    });

    it('never leaks Company B records when querying within Company A scope', async () => {
      const scopeA = createTenantScope({
        companyId: companyAId,
        userId: userAdminAId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-a',
      });

      const deptsA = await scopeA.departments.findMany();
      expect(deptsA.length).toBeGreaterThan(0);
      for (const dept of deptsA) {
        expect(dept.companyId).toBe(companyAId);
        expect(dept.companyId).not.toBe(companyBId);
      }
    });

    it('throws non-revealing NotFoundError when looking up a foreign tenant ID', async () => {
      const scopeA = createTenantScope({
        companyId: companyAId,
        userId: userAdminAId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-a',
      });

      const scopeB = createTenantScope({
        companyId: companyBId,
        userId: userAdminBId,
        role: MembershipRole.COMPANY_ADMIN,
        membershipId: 'mem-b',
      });

      // Create unique department in Company B
      const deptB = await scopeB.departments.create({ name: 'Finance' });

      // Company A attempts to access Company B's department using known ID
      await expect(scopeA.departments.findById(deptB.id)).rejects.toThrow(NotFoundError);
    });

    it('assertTenantOwnership throws NotFoundError on tenant mismatch', () => {
      expect(() => {
        assertTenantOwnership(companyBId, companyAId, 'Department');
      }).toThrow(NotFoundError);

      expect(() => {
        assertTenantOwnership(companyAId, companyAId, 'Department');
      }).not.toThrow();
    });
  });
});
