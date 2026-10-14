import {
  MembershipRole,
  MembershipStatus,
  CompanyStatus,
  UserStatus,
  DepartmentStatus,
  PositionStatus,
  EmploymentStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from './prisma';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../../common/errors/app-error';

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
      async findMany(where?: { status?: DepartmentStatus }) {
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

      async create(data: { name: string; code?: string | null }) {
        const existing = await prisma.department.findUnique({
          where: {
            companyId_name: {
              companyId: context.companyId,
              name: data.name,
            },
          },
        });
        if (existing) {
          throw new ConflictError('A department with this name already exists in this company');
        }

        return prisma.department.create({
          data: {
            companyId: context.companyId,
            name: data.name,
            code: data.code,
          },
        });
      },

      async update(id: string, data: { name?: string; code?: string | null; status?: DepartmentStatus }) {
        const current = await prisma.department.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Department not found');
        }

        if (data.name && data.name !== current.name) {
          const existing = await prisma.department.findUnique({
            where: {
              companyId_name: {
                companyId: context.companyId,
                name: data.name,
              },
            },
          });
          if (existing) {
            throw new ConflictError('A department with this name already exists in this company');
          }
        }

        return prisma.department.update({
          where: { id },
          data: {
            name: data.name,
            code: data.code,
            status: data.status,
          },
        });
      },
    },

    positions: {
      async findMany(where?: { status?: PositionStatus }) {
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
        const existing = await prisma.position.findUnique({
          where: {
            companyId_name: {
              companyId: context.companyId,
              name: data.name,
            },
          },
        });
        if (existing) {
          throw new ConflictError('A position with this name already exists in this company');
        }

        return prisma.position.create({
          data: {
            companyId: context.companyId,
            name: data.name,
          },
        });
      },

      async update(id: string, data: { name?: string; status?: PositionStatus }) {
        const current = await prisma.position.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Position not found');
        }

        if (data.name && data.name !== current.name) {
          const existing = await prisma.position.findUnique({
            where: {
              companyId_name: {
                companyId: context.companyId,
                name: data.name,
              },
            },
          });
          if (existing) {
            throw new ConflictError('A position with this name already exists in this company');
          }
        }

        return prisma.position.update({
          where: { id },
          data: {
            name: data.name,
            status: data.status,
          },
        });
      },
    },

    employees: {
      async findMany(params?: {
        page?: number;
        pageSize?: number;
        search?: string;
        departmentId?: string;
        positionId?: string;
        status?: EmploymentStatus;
      }) {
        const page = Math.max(1, params?.page || 1);
        const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
        const skip = (page - 1) * pageSize;

        const where: Prisma.EmployeeWhereInput = {
          companyId: context.companyId,
        };

        if (params?.status) {
          where.employmentStatus = params.status;
        }

        if (params?.departmentId) {
          where.departmentId = params.departmentId;
        }

        if (params?.positionId) {
          where.positionId = params.positionId;
        }

        if (params?.search && params.search.trim()) {
          const q = params.search.trim();
          where.OR = [
            { fullName: { contains: q, mode: 'insensitive' } },
            { employeeNumber: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ];
        }

        const [total, items] = await Promise.all([
          prisma.employee.count({ where }),
          prisma.employee.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [{ createdAt: 'desc' }],
            include: {
              department: { select: { id: true, name: true, code: true } },
              position: { select: { id: true, name: true } },
              manager: { select: { id: true, fullName: true, employeeNumber: true } },
            },
          }),
        ]);

        return {
          items,
          total,
          page,
          pageSize,
          hasMore: skip + items.length < total,
        };
      },

      async findById(id: string) {
        const emp = await prisma.employee.findUnique({
          where: { id },
          include: {
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            manager: { select: { id: true, fullName: true, employeeNumber: true } },
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

        if (!emp || emp.companyId !== context.companyId) {
          throw new NotFoundError('Employee not found');
        }

        return emp;
      },

      async findByUserId(userId: string) {
        return prisma.employee.findFirst({
          where: {
            companyId: context.companyId,
            userId,
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            manager: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        });
      },

      async create(data: {
        employeeNumber: string;
        fullName: string;
        email?: string | null;
        phone?: string | null;
        departmentId?: string | null;
        positionId?: string | null;
        managerEmployeeId?: string | null;
        userId?: string | null;
        hireDate?: Date | null;
      }) {
        // 1. Check duplicate employeeNumber
        const existingNum = await prisma.employee.findUnique({
          where: {
            companyId_employeeNumber: {
              companyId: context.companyId,
              employeeNumber: data.employeeNumber,
            },
          },
        });
        if (existingNum) {
          throw new ConflictError(
            `Employee with employee number '${data.employeeNumber}' already exists in this company`
          );
        }

        // 2. Validate department belongs to same company
        if (data.departmentId) {
          const dept = await prisma.department.findUnique({
            where: { id: data.departmentId },
          });
          if (!dept || dept.companyId !== context.companyId) {
            throw new BadRequestError('Department does not belong to this company');
          }
        }

        // 3. Validate position belongs to same company
        if (data.positionId) {
          const pos = await prisma.position.findUnique({
            where: { id: data.positionId },
          });
          if (!pos || pos.companyId !== context.companyId) {
            throw new BadRequestError('Position does not belong to this company');
          }
        }

        // 4. Validate manager belongs to same company
        if (data.managerEmployeeId) {
          const mgr = await prisma.employee.findUnique({
            where: { id: data.managerEmployeeId },
          });
          if (!mgr || mgr.companyId !== context.companyId) {
            throw new BadRequestError('Manager does not belong to this company');
          }
        }

        // 5. Validate user membership in this tenant
        if (data.userId) {
          const membership = await prisma.companyMembership.findUnique({
            where: {
              companyId_userId: {
                companyId: context.companyId,
                userId: data.userId,
              },
            },
          });
          if (!membership) {
            throw new BadRequestError('Selected user does not have an active membership in this company');
          }

          const existingUserEmp = await prisma.employee.findUnique({
            where: {
              companyId_userId: {
                companyId: context.companyId,
                userId: data.userId,
              },
            },
          });
          if (existingUserEmp) {
            throw new ConflictError('User is already linked to an employee in this company');
          }
        }

        return prisma.employee.create({
          data: {
            companyId: context.companyId,
            employeeNumber: data.employeeNumber,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            departmentId: data.departmentId,
            positionId: data.positionId,
            managerEmployeeId: data.managerEmployeeId,
            userId: data.userId,
            hireDate: data.hireDate,
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            manager: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        });
      },

      async update(
        id: string,
        data: {
          fullName?: string;
          email?: string | null;
          phone?: string | null;
          departmentId?: string | null;
          positionId?: string | null;
          managerEmployeeId?: string | null;
          hireDate?: Date | null;
        }
      ) {
        const current = await prisma.employee.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Employee not found');
        }

        if (data.departmentId) {
          const dept = await prisma.department.findUnique({
            where: { id: data.departmentId },
          });
          if (!dept || dept.companyId !== context.companyId) {
            throw new BadRequestError('Department does not belong to this company');
          }
        }

        if (data.positionId) {
          const pos = await prisma.position.findUnique({
            where: { id: data.positionId },
          });
          if (!pos || pos.companyId !== context.companyId) {
            throw new BadRequestError('Position does not belong to this company');
          }
        }

        if (data.managerEmployeeId) {
          if (data.managerEmployeeId === id) {
            throw new BadRequestError('An employee cannot be their own manager');
          }
          const mgr = await prisma.employee.findUnique({
            where: { id: data.managerEmployeeId },
          });
          if (!mgr || mgr.companyId !== context.companyId) {
            throw new BadRequestError('Manager does not belong to this company');
          }
        }

        return prisma.employee.update({
          where: { id },
          data: {
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            departmentId: data.departmentId,
            positionId: data.positionId,
            managerEmployeeId: data.managerEmployeeId,
            hireDate: data.hireDate,
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            manager: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        });
      },

      async updateStatus(
        id: string,
        data: {
          status: EmploymentStatus;
          terminationDate?: Date | null;
        }
      ) {
        const current = await prisma.employee.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Employee not found');
        }

        return prisma.employee.update({
          where: { id },
          data: {
            employmentStatus: data.status,
            terminationDate: data.terminationDate,
          },
          include: {
            department: { select: { id: true, name: true, code: true } },
            position: { select: { id: true, name: true } },
            manager: { select: { id: true, fullName: true, employeeNumber: true } },
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
