import { MembershipRole, MembershipStatus, CompanyStatus, UserStatus } from '@prisma/client';
import { prisma } from './prisma';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';

export interface TenantContext {
  companyId: string;
  userId: string;
  role: MembershipRole;
  membershipId: string;
}

/**
 * Validates that a user has an active membership in the given tenant/company.
 * Returns the TenantContext if valid, or throws ForbiddenError.
 */
export async function validateMembership(
  userId: string,
  companyId: string
): Promise<TenantContext> {
  const membership = await prisma.companyMembership.findUnique({
    where: {
      companyId_userId: {
        companyId,
        userId,
      },
    },
    include: {
      company: true,
      user: true,
    },
  });

  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new ForbiddenError('User has no active membership in this company');
  }

  if (membership.user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenError('User account is not active');
  }

  if (membership.company.status !== CompanyStatus.ACTIVE) {
    throw new ForbiddenError('Company tenant is suspended or inactive');
  }

  return {
    companyId: membership.companyId,
    userId: membership.userId,
    role: membership.role,
    membershipId: membership.id,
  };
}

/**
 * Asserts that a retrieved entity belongs to the active tenant.
 * Throws a non-revealing NotFoundError if there is a cross-tenant attempt.
 */
export function assertTenantOwnership(
  entityCompanyId: string,
  contextCompanyId: string,
  resourceName = 'Resource'
): void {
  if (entityCompanyId !== contextCompanyId) {
    throw new NotFoundError(`${resourceName} not found`);
  }
}

/**
 * Creates tenant-scoped repository operations for the given TenantContext.
 * Ensures queries always enforce companyId = context.companyId.
 */
export function createTenantScope(context: TenantContext) {
  return {
    context,

    departments: {
      async findMany(where?: { status?: 'ACTIVE' | 'INACTIVE' }) {
        return prisma.department.findMany({
          where: {
            companyId: context.companyId,
            ...(where?.status ? { status: where.status } : {}),
          },
          orderBy: { name: 'asc' },
        });
      },

      async findById(id: string) {
        const dept = await prisma.department.findUnique({
          where: { id },
        });
        if (!dept || dept.companyId !== context.companyId) {
          throw new NotFoundError('Department not found');
        }
        return dept;
      },

      async create(data: { name: string; code?: string }) {
        return prisma.department.create({
          data: {
            companyId: context.companyId,
            name: data.name,
            code: data.code,
          },
        });
      },
    },

    positions: {
      async findMany(where?: { status?: 'ACTIVE' | 'INACTIVE' }) {
        return prisma.position.findMany({
          where: {
            companyId: context.companyId,
            ...(where?.status ? { status: where.status } : {}),
          },
          orderBy: { name: 'asc' },
        });
      },

      async findById(id: string) {
        const pos = await prisma.position.findUnique({
          where: { id },
        });
        if (!pos || pos.companyId !== context.companyId) {
          throw new NotFoundError('Position not found');
        }
        return pos;
      },

      async create(data: { name: string }) {
        return prisma.position.create({
          data: {
            companyId: context.companyId,
            name: data.name,
          },
        });
      },
    },

    memberships: {
      async findMany(where?: { status?: MembershipStatus }) {
        return prisma.companyMembership.findMany({
          where: {
            companyId: context.companyId,
            ...(where?.status ? { status: where.status } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                status: true,
              },
            },
          },
        });
      },
    },
  };
}
