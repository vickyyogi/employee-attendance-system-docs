import crypto from 'crypto';
import {
  MembershipRole,
  MembershipStatus,
  CompanyStatus,
  UserStatus,
  DepartmentStatus,
  PositionStatus,
  EmploymentStatus,
  AttendanceStatus,
  AttendanceEventType,
  Prisma,
} from '@prisma/client';
import { prisma } from './prisma';
import {
  ForbiddenError,
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
} from '../../common/errors/app-error';
import { env } from '../../config/env';
import { getStorageService } from '../storage/storage.factory';
import { verifyImageMagicBytes } from '../storage/magic-bytes';
import { calculateHaversineDistanceMeters } from '../../common/utils/geo';
import {
  getCalendarDateString,
  getLocalTimeString,
  isCheckInLate,
} from '../../common/utils/time';

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

    workLocations: {
      async findMany(where?: { isActive?: boolean }) {
        return prisma.workLocation.findMany({
          where: {
            companyId: context.companyId,
            ...(where?.isActive !== undefined ? { isActive: where.isActive } : {}),
          },
          orderBy: { name: 'asc' },
        });
      },

      async findById(id: string) {
        const loc = await prisma.workLocation.findUnique({ where: { id } });
        if (!loc || loc.companyId !== context.companyId) {
          throw new NotFoundError('Work location not found');
        }
        return loc;
      },

      async create(data: {
        name: string;
        address?: string | null;
        latitude: number | Prisma.Decimal;
        longitude: number | Prisma.Decimal;
        geofenceRadiusM?: number;
        maxGpsAccuracyM?: number;
        isActive?: boolean;
      }) {
        const lat = Number(data.latitude);
        const lng = Number(data.longitude);
        if (lat < -90 || lat > 90) {
          throw new BadRequestError('Latitude must be between -90 and 90');
        }
        if (lng < -180 || lng > 180) {
          throw new BadRequestError('Longitude must be between -180 and 180');
        }
        if (data.geofenceRadiusM !== undefined && data.geofenceRadiusM <= 0) {
          throw new BadRequestError('Geofence radius must be greater than 0');
        }
        if (data.maxGpsAccuracyM !== undefined && data.maxGpsAccuracyM <= 0) {
          throw new BadRequestError('Maximum GPS accuracy must be greater than 0');
        }

        return prisma.workLocation.create({
          data: {
            companyId: context.companyId,
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            geofenceRadiusM: data.geofenceRadiusM ?? 100,
            maxGpsAccuracyM: data.maxGpsAccuracyM ?? 50,
            isActive: data.isActive ?? true,
          },
        });
      },

      async update(
        id: string,
        data: {
          name?: string;
          address?: string | null;
          latitude?: number | Prisma.Decimal;
          longitude?: number | Prisma.Decimal;
          geofenceRadiusM?: number;
          maxGpsAccuracyM?: number;
          isActive?: boolean;
        }
      ) {
        const current = await prisma.workLocation.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Work location not found');
        }

        if (data.latitude !== undefined) {
          const lat = Number(data.latitude);
          if (lat < -90 || lat > 90) {
            throw new BadRequestError('Latitude must be between -90 and 90');
          }
        }
        if (data.longitude !== undefined) {
          const lng = Number(data.longitude);
          if (lng < -180 || lng > 180) {
            throw new BadRequestError('Longitude must be between -180 and 180');
          }
        }
        if (data.geofenceRadiusM !== undefined && data.geofenceRadiusM <= 0) {
          throw new BadRequestError('Geofence radius must be greater than 0');
        }
        if (data.maxGpsAccuracyM !== undefined && data.maxGpsAccuracyM <= 0) {
          throw new BadRequestError('Maximum GPS accuracy must be greater than 0');
        }

        return prisma.workLocation.update({
          where: { id },
          data: {
            name: data.name,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            geofenceRadiusM: data.geofenceRadiusM,
            maxGpsAccuracyM: data.maxGpsAccuracyM,
            isActive: data.isActive,
          },
        });
      },
    },

    shifts: {
      async findMany(where?: { isActive?: boolean }) {
        return prisma.shift.findMany({
          where: {
            companyId: context.companyId,
            ...(where?.isActive !== undefined ? { isActive: where.isActive } : {}),
          },
          orderBy: { name: 'asc' },
        });
      },

      async findById(id: string) {
        const shift = await prisma.shift.findUnique({ where: { id } });
        if (!shift || shift.companyId !== context.companyId) {
          throw new NotFoundError('Shift not found');
        }
        return shift;
      },

      async create(data: {
        name: string;
        startTimeLocal: string;
        endTimeLocal: string;
        crossesMidnight?: boolean;
        gracePeriodMinutes?: number;
        isActive?: boolean;
      }) {
        const existing = await prisma.shift.findUnique({
          where: {
            companyId_name: {
              companyId: context.companyId,
              name: data.name,
            },
          },
        });
        if (existing) {
          throw new ConflictError(`Shift with name '${data.name}' already exists in this company`);
        }

        if (data.gracePeriodMinutes !== undefined && data.gracePeriodMinutes < 0) {
          throw new BadRequestError('Grace period minutes must be non-negative');
        }

        const crossesMidnight =
          data.crossesMidnight !== undefined
            ? data.crossesMidnight
            : data.endTimeLocal < data.startTimeLocal;

        return prisma.shift.create({
          data: {
            companyId: context.companyId,
            name: data.name,
            startTimeLocal: data.startTimeLocal,
            endTimeLocal: data.endTimeLocal,
            crossesMidnight,
            gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
            isActive: data.isActive ?? true,
          },
        });
      },

      async update(
        id: string,
        data: {
          name?: string;
          startTimeLocal?: string;
          endTimeLocal?: string;
          crossesMidnight?: boolean;
          gracePeriodMinutes?: number;
          isActive?: boolean;
        }
      ) {
        const current = await prisma.shift.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Shift not found');
        }

        if (data.name && data.name !== current.name) {
          const existing = await prisma.shift.findUnique({
            where: {
              companyId_name: {
                companyId: context.companyId,
                name: data.name,
              },
            },
          });
          if (existing) {
            throw new ConflictError(`Shift with name '${data.name}' already exists in this company`);
          }
        }

        if (data.gracePeriodMinutes !== undefined && data.gracePeriodMinutes < 0) {
          throw new BadRequestError('Grace period minutes must be non-negative');
        }

        const start = data.startTimeLocal ?? current.startTimeLocal;
        const end = data.endTimeLocal ?? current.endTimeLocal;
        const crossesMidnight =
          data.crossesMidnight !== undefined ? data.crossesMidnight : end < start;

        return prisma.shift.update({
          where: { id },
          data: {
            name: data.name,
            startTimeLocal: data.startTimeLocal,
            endTimeLocal: data.endTimeLocal,
            crossesMidnight,
            gracePeriodMinutes: data.gracePeriodMinutes,
            isActive: data.isActive,
          },
        });
      },
    },

    employeeShifts: {
      async findMany(params?: {
        employeeId?: string;
        shiftId?: string;
        effectiveDate?: Date;
      }) {
        const where: Prisma.EmployeeShiftWhereInput = {
          companyId: context.companyId,
        };

        if (params?.employeeId) {
          where.employeeId = params.employeeId;
        }

        if (params?.shiftId) {
          where.shiftId = params.shiftId;
        }

        if (params?.effectiveDate) {
          where.effectiveFrom = { lte: params.effectiveDate };
          where.OR = [
            { effectiveTo: null },
            { effectiveTo: { gte: params.effectiveDate } },
          ];
        }

        return prisma.employeeShift.findMany({
          where,
          orderBy: { effectiveFrom: 'desc' },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
            shift: {
              select: {
                id: true,
                name: true,
                startTimeLocal: true,
                endTimeLocal: true,
                crossesMidnight: true,
                gracePeriodMinutes: true,
              },
            },
          },
        });
      },

      async findById(id: string) {
        const es = await prisma.employeeShift.findUnique({
          where: { id },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
            shift: {
              select: {
                id: true,
                name: true,
                startTimeLocal: true,
                endTimeLocal: true,
                crossesMidnight: true,
                gracePeriodMinutes: true,
              },
            },
          },
        });
        if (!es || es.companyId !== context.companyId) {
          throw new NotFoundError('Employee shift assignment not found');
        }
        return es;
      },

      async create(data: {
        employeeId: string;
        shiftId: string;
        effectiveFrom: Date;
        effectiveTo?: Date | null;
      }) {
        // Validate employee belongs to same company
        const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
        if (!emp || emp.companyId !== context.companyId) {
          throw new BadRequestError('Employee does not belong to this company');
        }

        // Validate shift belongs to same company
        const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
        if (!shift || shift.companyId !== context.companyId) {
          throw new BadRequestError('Shift does not belong to this company');
        }

        // Validate date ranges
        if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
          throw new BadRequestError('effectiveTo date cannot be earlier than effectiveFrom date');
        }

        return prisma.employeeShift.create({
          data: {
            companyId: context.companyId,
            employeeId: data.employeeId,
            shiftId: data.shiftId,
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo,
          },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
            shift: {
              select: {
                id: true,
                name: true,
                startTimeLocal: true,
                endTimeLocal: true,
                crossesMidnight: true,
                gracePeriodMinutes: true,
              },
            },
          },
        });
      },

      async delete(id: string) {
        const current = await prisma.employeeShift.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Employee shift assignment not found');
        }
        return prisma.employeeShift.delete({ where: { id } });
      },
    },

    holidays: {
      async findMany(params?: { year?: number }) {
        const where: Prisma.HolidayWhereInput = {
          companyId: context.companyId,
        };

        if (params?.year) {
          const startOfYear = new Date(`${params.year}-01-01T00:00:00.000Z`);
          const endOfYear = new Date(`${params.year}-12-31T23:59:59.999Z`);
          where.date = {
            gte: startOfYear,
            lte: endOfYear,
          };
        }

        return prisma.holiday.findMany({
          where,
          orderBy: { date: 'asc' },
        });
      },

      async findById(id: string) {
        const holiday = await prisma.holiday.findUnique({ where: { id } });
        if (!holiday || holiday.companyId !== context.companyId) {
          throw new NotFoundError('Holiday not found');
        }
        return holiday;
      },

      async create(data: { date: Date; name: string }) {
        const existing = await prisma.holiday.findUnique({
          where: {
            companyId_date: {
              companyId: context.companyId,
              date: data.date,
            },
          },
        });
        if (existing) {
          throw new ConflictError('A holiday is already registered on this date for this company');
        }

        return prisma.holiday.create({
          data: {
            companyId: context.companyId,
            date: data.date,
            name: data.name,
          },
        });
      },

      async update(id: string, data: { date?: Date; name?: string }) {
        const current = await prisma.holiday.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Holiday not found');
        }

        if (data.date && data.date.getTime() !== current.date.getTime()) {
          const existing = await prisma.holiday.findUnique({
            where: {
              companyId_date: {
                companyId: context.companyId,
                date: data.date,
              },
            },
          });
          if (existing) {
            throw new ConflictError('A holiday is already registered on this date for this company');
          }
        }

        return prisma.holiday.update({
          where: { id },
          data: {
            date: data.date,
            name: data.name,
          },
        });
      },

      async delete(id: string) {
        const current = await prisma.holiday.findUnique({ where: { id } });
        if (!current || current.companyId !== context.companyId) {
          throw new NotFoundError('Holiday not found');
        }
        return prisma.holiday.delete({ where: { id } });
      },
    },

    selfieUploads: {
      async createIntent(data: {
        userId: string;
        employeeId?: string | null;
        mimeType: string;
        originalName?: string;
        fileSizeBytes?: number;
      }) {
        const id = crypto.randomUUID();
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const ext =
          data.mimeType === 'image/png'
            ? 'png'
            : data.mimeType === 'image/webp'
              ? 'webp'
              : 'jpg';
        const objectKey = `tenants/${context.companyId}/selfies/${year}/${month}/${id}.${ext}`;
        const uploadUrlExpiresAt = new Date(
          Date.now() + env.STORAGE_UPLOAD_EXPIRY_SECONDS * 1000
        );

        const storage = getStorageService();
        const { uploadUrl, requiredHeaders } = await storage.generateUploadUrl(
          objectKey,
          data.mimeType,
          env.STORAGE_UPLOAD_EXPIRY_SECONDS
        );

        const upload = await prisma.selfieUpload.create({
          data: {
            id,
            companyId: context.companyId,
            userId: data.userId,
            employeeId: data.employeeId || null,
            objectKey,
            originalName: data.originalName,
            mimeType: data.mimeType,
            fileSizeBytes: data.fileSizeBytes,
            status: 'PENDING',
            uploadUrlExpiresAt,
          },
        });

        return {
          upload,
          uploadUrl,
          requiredHeaders,
          expiresInSeconds: env.STORAGE_UPLOAD_EXPIRY_SECONDS,
          maxFileSizeBytes: env.STORAGE_MAX_FILE_SIZE_BYTES,
        };
      },

      async getById(id: string) {
        const upload = await prisma.selfieUpload.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        });
        if (!upload || upload.companyId !== context.companyId) {
          throw new NotFoundError('Selfie upload not found');
        }
        return upload;
      },

      async complete(id: string, actorUserId: string) {
        const upload = await prisma.selfieUpload.findUnique({ where: { id } });
        if (!upload || upload.companyId !== context.companyId) {
          throw new NotFoundError('Selfie upload not found');
        }

        // Must be the owner of the upload
        if (upload.userId !== actorUserId) {
          throw new ForbiddenError('You can only complete your own selfie uploads');
        }

        if (upload.status === 'COMPLETED' || upload.status === 'ATTACHED') {
          return upload;
        }

        const storage = getStorageService();
        const exists = await storage.objectExists(upload.objectKey);
        if (!exists) {
          throw new BadRequestError('Physical selfie file has not been uploaded to storage yet');
        }

        const { buffer, size } = await storage.getObject(upload.objectKey);

        // Enforce max upload size constraint
        if (size > env.STORAGE_MAX_FILE_SIZE_BYTES) {
          await storage.deleteObject(upload.objectKey);
          await prisma.selfieUpload.update({
            where: { id },
            data: { status: 'FAILED' },
          });
          throw new UnprocessableEntityError(
            `File size (${size} bytes) exceeds maximum allowable limit (${env.STORAGE_MAX_FILE_SIZE_BYTES} bytes)`
          );
        }

        // Verify magic bytes (binary file signature)
        const magicCheck = verifyImageMagicBytes(buffer, upload.mimeType);
        if (!magicCheck.valid) {
          await storage.deleteObject(upload.objectKey);
          await prisma.selfieUpload.update({
            where: { id },
            data: { status: 'FAILED' },
          });
          throw new UnprocessableEntityError(`Image verification failed: ${magicCheck.reason}`);
        }

        // Calculate SHA-256 hash for integrity and tamper evidence
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        return prisma.selfieUpload.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            fileSizeBytes: size,
            fileHashSha256: hash,
            completedAt: new Date(),
          },
        });
      },

      async generateSignedReadUrl(id: string, actorUserId: string, isPrivileged: boolean) {
        const upload = await prisma.selfieUpload.findUnique({ where: { id } });
        if (!upload || upload.companyId !== context.companyId) {
          throw new NotFoundError('Selfie upload not found');
        }

        // Regular employees can only view their own selfies. Privileged roles (COMPANY_ADMIN, HR_ADMIN) can view within tenant.
        if (!isPrivileged && upload.userId !== actorUserId) {
          throw new NotFoundError('Selfie upload not found');
        }

        if (upload.status !== 'COMPLETED' && upload.status !== 'ATTACHED') {
          throw new BadRequestError('Selfie upload has not been completed');
        }

        const storage = getStorageService();
        const { readUrl } = await storage.generateSignedReadUrl(
          upload.objectKey,
          env.STORAGE_READ_EXPIRY_SECONDS
        );

        return {
          readUrl,
          expiresInSeconds: env.STORAGE_READ_EXPIRY_SECONDS,
          objectKey: upload.objectKey,
          upload,
        };
      },

      async cleanupExpired(olderThanHours = 24) {
        const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
        const expiredPending = await prisma.selfieUpload.findMany({
          where: {
            companyId: context.companyId,
            status: 'PENDING',
            uploadUrlExpiresAt: { lt: new Date() },
            createdAt: { lt: cutoff },
          },
        });

        const storage = getStorageService();
        let cleanedCount = 0;
        for (const item of expiredPending) {
          await storage.deleteObject(item.objectKey);
          await prisma.selfieUpload.update({
            where: { id: item.id },
            data: { status: 'EXPIRED' },
          });
          cleanedCount++;
        }
        return { cleanedCount };
      },
    },

    attendance: {
      async checkIn(data: {
        userId: string;
        workLocationId: string;
        latitude: number;
        longitude: number;
        accuracyM: number;
        selfieUploadId: string;
        idempotencyKey: string;
      }) {
        const company = await prisma.company.findUnique({
          where: { id: context.companyId },
        });
        if (!company) {
          throw new NotFoundError('Company not found');
        }

        // 1. Resolve employee
        const employee = await prisma.employee.findUnique({
          where: {
            companyId_userId: {
              companyId: context.companyId,
              userId: data.userId,
            },
          },
        });
        if (!employee || employee.employmentStatus !== EmploymentStatus.ACTIVE) {
          throw new ForbiddenError('Active employment record is required for attendance operations');
        }

        // 2. Check Idempotency Replay (safe return without duplicate work)
        const existingByKey = await prisma.attendanceRecord.findFirst({
          where: {
            companyId: context.companyId,
            idempotencyKey: data.idempotencyKey,
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
            workLocation: { select: { id: true, name: true } },
          },
        });
        if (existingByKey) {
          return existingByKey;
        }

        // 3. Validate workLocation
        const location = await prisma.workLocation.findUnique({
          where: { id: data.workLocationId },
        });
        if (!location || location.companyId !== context.companyId || !location.isActive) {
          throw new NotFoundError('Valid and active work location not found');
        }

        // 4. Validate GPS accuracy threshold
        if (data.accuracyM > location.maxGpsAccuracyM) {
          throw new UnprocessableEntityError(
            `GPS accuracy (${data.accuracyM}m) exceeds allowable threshold (${location.maxGpsAccuracyM}m)`
          );
        }

        // 5. Validate Geofence (Haversine distance)
        const distanceM = calculateHaversineDistanceMeters(
          data.latitude,
          data.longitude,
          location.latitude.toNumber(),
          location.longitude.toNumber()
        );
        if (distanceM > location.geofenceRadiusM) {
          throw new UnprocessableEntityError(
            `Outside geofence radius. Distance (${distanceM}m) exceeds radius (${location.geofenceRadiusM}m)`
          );
        }

        // 6. Validate Selfie Upload
        const upload = await prisma.selfieUpload.findUnique({
          where: { id: data.selfieUploadId },
        });
        if (
          !upload ||
          upload.companyId !== context.companyId ||
          upload.userId !== data.userId
        ) {
          throw new NotFoundError('Selfie upload not found or not owned by user');
        }
        if (upload.status !== 'COMPLETED' && upload.status !== 'ATTACHED') {
          throw new BadRequestError('Selfie upload has not completed verification');
        }

        // 7. Derive official server timestamp and work_date in company timezone
        const now = new Date();
        const workDateStr = getCalendarDateString(now, company.timezone);
        const workDate = new Date(`${workDateStr}T00:00:00.000Z`);

        // 8. Check duplicate check-in for the same work date
        const existingForDate = await prisma.attendanceRecord.findUnique({
          where: {
            companyId_employeeId_workDate: {
              companyId: context.companyId,
              employeeId: employee.id,
              workDate,
            },
          },
        });
        if (existingForDate) {
          if (existingForDate.idempotencyKey === data.idempotencyKey) {
            return prisma.attendanceRecord.findUniqueOrThrow({
              where: { id: existingForDate.id },
              include: {
                employee: { select: { id: true, fullName: true, employeeNumber: true } },
                shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
                workLocation: { select: { id: true, name: true } },
              },
            });
          }
          throw new ConflictError('Attendance already checked in for this date');
        }

        // 9. Resolve Shift and Lateness
        const assignedShift = await prisma.employeeShift.findFirst({
          where: {
            companyId: context.companyId,
            employeeId: employee.id,
            effectiveFrom: { lte: workDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: workDate } }],
          },
          include: { shift: true },
          orderBy: { effectiveFrom: 'desc' },
        });

        const activeShift =
          assignedShift?.shift ||
          (await prisma.shift.findFirst({
            where: { companyId: context.companyId, isActive: true },
          }));

        let isLate = false;
        if (activeShift) {
          const checkInTimeLocal = getLocalTimeString(now, company.timezone);
          isLate = isCheckInLate(
            checkInTimeLocal,
            activeShift.startTimeLocal,
            activeShift.gracePeriodMinutes
          );
        }

        const initialStatus: AttendanceStatus = isLate
          ? AttendanceStatus.LATE
          : AttendanceStatus.IN_PROGRESS;

        // 10. Execute Transactionally
        return prisma.$transaction(async (tx) => {
          const record = await tx.attendanceRecord.create({
            data: {
              companyId: context.companyId,
              employeeId: employee.id,
              workDate,
              shiftId: activeShift?.id || null,
              workLocationId: location.id,
              checkInAt: now,
              checkInLatitude: data.latitude,
              checkInLongitude: data.longitude,
              checkInAccuracyM: data.accuracyM,
              checkInDistanceM: distanceM,
              checkInGeofenceValid: true,
              checkInSelfieObjectKey: upload.objectKey,
              status: initialStatus,
              idempotencyKey: data.idempotencyKey,
            },
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true } },
              shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
              workLocation: { select: { id: true, name: true } },
            },
          });

          await tx.attendanceEvent.create({
            data: {
              companyId: context.companyId,
              attendanceRecordId: record.id,
              eventType: AttendanceEventType.CHECK_IN,
              occurredAt: now,
              actorUserId: data.userId,
              metadata: {
                distanceM,
                accuracyM: data.accuracyM,
                workLocationId: location.id,
                shiftId: activeShift?.id,
                isLate,
                selfieUploadId: data.selfieUploadId,
              },
            },
          });

          await tx.selfieUpload.update({
            where: { id: upload.id },
            data: { status: 'ATTACHED' },
          });

          return record;
        });
      },

      async checkOut(data: {
        userId: string;
        latitude: number;
        longitude: number;
        accuracyM: number;
        selfieUploadId?: string;
        workLocationId?: string;
        idempotencyKey: string;
      }) {
        const company = await prisma.company.findUnique({
          where: { id: context.companyId },
        });
        if (!company) {
          throw new NotFoundError('Company not found');
        }

        const employee = await prisma.employee.findUnique({
          where: {
            companyId_userId: {
              companyId: context.companyId,
              userId: data.userId,
            },
          },
        });
        if (!employee || employee.employmentStatus !== EmploymentStatus.ACTIVE) {
          throw new ForbiddenError('Active employment record is required for attendance operations');
        }

        // Idempotency check: if this checkout was already recorded
        const existingByKey = await prisma.attendanceRecord.findFirst({
          where: {
            companyId: context.companyId,
            employeeId: employee.id,
            checkOutAt: { not: null },
            events: {
              some: {
                eventType: AttendanceEventType.CHECK_OUT,
                metadata: {
                  path: ['idempotencyKey'],
                  equals: data.idempotencyKey,
                },
              },
            },
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
            workLocation: { select: { id: true, name: true } },
          },
        });
        if (existingByKey) {
          return existingByKey;
        }

        // Find open attendance record without checkOutAt
        const openRecord = await prisma.attendanceRecord.findFirst({
          where: {
            companyId: context.companyId,
            employeeId: employee.id,
            checkOutAt: null,
          },
          include: {
            shift: true,
            workLocation: true,
          },
          orderBy: { checkInAt: 'desc' },
        });

        if (!openRecord) {
          throw new ConflictError('No open attendance session found to check out');
        }

        // Validate location
        const targetLocationId = data.workLocationId || openRecord.workLocationId;
        let distanceM: number | null = null;
        if (targetLocationId) {
          const loc = await prisma.workLocation.findUnique({
            where: { id: targetLocationId },
          });
          if (loc && loc.companyId === context.companyId) {
            if (data.accuracyM > loc.maxGpsAccuracyM) {
              throw new UnprocessableEntityError(
                `GPS accuracy (${data.accuracyM}m) exceeds allowable threshold (${loc.maxGpsAccuracyM}m)`
              );
            }
            distanceM = calculateHaversineDistanceMeters(
              data.latitude,
              data.longitude,
              loc.latitude.toNumber(),
              loc.longitude.toNumber()
            );
            if (distanceM > loc.geofenceRadiusM) {
              throw new UnprocessableEntityError(
                `Outside geofence radius. Distance (${distanceM}m) exceeds radius (${loc.geofenceRadiusM}m)`
              );
            }
          }
        }

        // Validate checkout selfie if supplied
        let checkoutSelfieKey: string | null = null;
        if (data.selfieUploadId) {
          const upload = await prisma.selfieUpload.findUnique({
            where: { id: data.selfieUploadId },
          });
          if (!upload || upload.companyId !== context.companyId || upload.userId !== data.userId) {
            throw new NotFoundError('Selfie upload not found or not owned by user');
          }
          if (upload.status !== 'COMPLETED') {
            throw new BadRequestError('Selfie upload has not completed verification');
          }
          checkoutSelfieKey = upload.objectKey;
        }

        const finalStatus =
          openRecord.status === AttendanceStatus.IN_PROGRESS
            ? AttendanceStatus.PRESENT
            : openRecord.status;

        const now = new Date();

        return prisma.$transaction(async (tx) => {
          const updated = await tx.attendanceRecord.update({
            where: { id: openRecord.id },
            data: {
              checkOutAt: now,
              checkOutLatitude: data.latitude,
              checkOutLongitude: data.longitude,
              checkOutAccuracyM: data.accuracyM,
              checkOutDistanceM: distanceM,
              checkOutGeofenceValid: true,
              checkOutSelfieObjectKey: checkoutSelfieKey,
              status: finalStatus,
            },
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true } },
              shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
              workLocation: { select: { id: true, name: true } },
            },
          });

          await tx.attendanceEvent.create({
            data: {
              companyId: context.companyId,
              attendanceRecordId: openRecord.id,
              eventType: AttendanceEventType.CHECK_OUT,
              occurredAt: now,
              actorUserId: data.userId,
              metadata: {
                idempotencyKey: data.idempotencyKey,
                distanceM,
                accuracyM: data.accuracyM,
                status: finalStatus,
                selfieUploadId: data.selfieUploadId,
              },
            },
          });

          if (data.selfieUploadId) {
            await tx.selfieUpload.update({
              where: { id: data.selfieUploadId },
              data: { status: 'ATTACHED' },
            });
          }

          return updated;
        });
      },

      async getToday(userId: string) {
        const company = await prisma.company.findUnique({
          where: { id: context.companyId },
        });
        if (!company) {
          throw new NotFoundError('Company not found');
        }

        const employee = await prisma.employee.findUnique({
          where: {
            companyId_userId: {
              companyId: context.companyId,
              userId,
            },
          },
        });
        if (!employee) {
          return null;
        }

        const workDateStr = getCalendarDateString(new Date(), company.timezone);
        const workDate = new Date(`${workDateStr}T00:00:00.000Z`);

        return prisma.attendanceRecord.findUnique({
          where: {
            companyId_employeeId_workDate: {
              companyId: context.companyId,
              employeeId: employee.id,
              workDate,
            },
          },
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
            workLocation: { select: { id: true, name: true } },
          },
        });
      },

      async getMine(userId: string, limit = 30) {
        const employee = await prisma.employee.findUnique({
          where: {
            companyId_userId: {
              companyId: context.companyId,
              userId,
            },
          },
        });
        if (!employee) {
          return [];
        }

        return prisma.attendanceRecord.findMany({
          where: {
            companyId: context.companyId,
            employeeId: employee.id,
          },
          include: {
            shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
            workLocation: { select: { id: true, name: true } },
          },
          orderBy: { workDate: 'desc' },
          take: limit,
        });
      },

      async search(query: {
        employeeId?: string;
        workLocationId?: string;
        status?: AttendanceStatus;
        startDate?: string;
        endDate?: string;
        page?: number;
        pageSize?: number;
      }) {
        const where: Prisma.AttendanceRecordWhereInput = {
          companyId: context.companyId,
        };

        if (query.employeeId) where.employeeId = query.employeeId;
        if (query.workLocationId) where.workLocationId = query.workLocationId;
        if (query.status) where.status = query.status;
        if (query.startDate || query.endDate) {
          where.workDate = {};
          if (query.startDate) where.workDate.gte = new Date(`${query.startDate}T00:00:00.000Z`);
          if (query.endDate) where.workDate.lte = new Date(`${query.endDate}T00:00:00.000Z`);
        }

        const page = query.page && query.page > 0 ? query.page : 1;
        const pageSize =
          query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
        const skip = (page - 1) * pageSize;

        const [records, total] = await Promise.all([
          prisma.attendanceRecord.findMany({
            where,
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true } },
              shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
              workLocation: { select: { id: true, name: true } },
            },
            orderBy: { workDate: 'desc' },
            skip,
            take: pageSize,
          }),
          prisma.attendanceRecord.count({ where }),
        ]);

        return { records, total, page, pageSize };
      },

      async getById(id: string, userId: string, isPrivileged: boolean) {
        const record = await prisma.attendanceRecord.findUnique({
          where: { id },
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, userId: true } },
            shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
            workLocation: { select: { id: true, name: true } },
            events: {
              orderBy: { occurredAt: 'asc' },
            },
          },
        });
        if (!record || record.companyId !== context.companyId) {
          throw new NotFoundError('Attendance record not found');
        }

        if (!isPrivileged && record.employee.userId !== userId) {
          throw new NotFoundError('Attendance record not found');
        }

        return record;
      },

      async flag(id: string, reason: string, actorUserId: string) {
        const record = await prisma.attendanceRecord.findUnique({ where: { id } });
        if (!record || record.companyId !== context.companyId) {
          throw new NotFoundError('Attendance record not found');
        }

        return prisma.$transaction(async (tx) => {
          const updated = await tx.attendanceRecord.update({
            where: { id },
            data: {
              status: AttendanceStatus.FLAGGED,
              flagReason: reason,
            },
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true } },
              shift: { select: { id: true, name: true, startTimeLocal: true, endTimeLocal: true } },
              workLocation: { select: { id: true, name: true } },
            },
          });

          await tx.attendanceEvent.create({
            data: {
              companyId: context.companyId,
              attendanceRecordId: id,
              eventType: AttendanceEventType.FLAG,
              actorUserId,
              metadata: { reason },
            },
          });

          return updated;
        });
      },

      async getSignedSelfieUrl(
        recordId: string,
        kind: 'check_in' | 'check_out',
        userId: string,
        isPrivileged: boolean
      ) {
        const record = await prisma.attendanceRecord.findUnique({
          where: { id: recordId },
          include: {
            employee: { select: { id: true, userId: true } },
          },
        });
        if (!record || record.companyId !== context.companyId) {
          throw new NotFoundError('Attendance record not found');
        }

        if (!isPrivileged && record.employee.userId !== userId) {
          throw new NotFoundError('Attendance record not found');
        }

        const objectKey =
          kind === 'check_in'
            ? record.checkInSelfieObjectKey
            : record.checkOutSelfieObjectKey;

        if (!objectKey) {
          throw new NotFoundError(`No ${kind} selfie associated with this attendance record`);
        }

        const storage = getStorageService();
        const { readUrl } = await storage.generateSignedReadUrl(
          objectKey,
          env.STORAGE_READ_EXPIRY_SECONDS
        );

        return {
          readUrl,
          expiresInSeconds: env.STORAGE_READ_EXPIRY_SECONDS,
          objectKey,
          record,
        };
      },
    },
  };
}
