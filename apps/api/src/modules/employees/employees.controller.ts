import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import { hasPermission } from '../../common/auth/permissions';
import { ForbiddenError } from '../../common/errors/app-error';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  employeeIdParamSchema,
  listEmployeesQuerySchema,
} from './employees.schema';
import type { ApiResponse, EmployeeDto } from '@attendance/api-contracts';

function formatEmployee(emp: {
  id: string;
  companyId: string;
  userId: string | null;
  employeeNumber: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  department?: { id: string; name: string; code: string | null } | null;
  positionId: string | null;
  position?: { id: string; name: string } | null;
  managerEmployeeId: string | null;
  manager?: { id: string; fullName: string; employeeNumber: string } | null;
  employmentStatus: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  hireDate: Date | null;
  terminationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmployeeDto {
  return {
    id: emp.id,
    companyId: emp.companyId,
    userId: emp.userId,
    employeeNumber: emp.employeeNumber,
    fullName: emp.fullName,
    email: emp.email,
    phone: emp.phone,
    departmentId: emp.departmentId,
    department: emp.department
      ? {
          id: emp.department.id,
          name: emp.department.name,
          code: emp.department.code,
        }
      : null,
    positionId: emp.positionId,
    position: emp.position
      ? {
          id: emp.position.id,
          name: emp.position.name,
        }
      : null,
    managerEmployeeId: emp.managerEmployeeId,
    manager: emp.manager
      ? {
          id: emp.manager.id,
          fullName: emp.manager.fullName,
          employeeNumber: emp.manager.employeeNumber,
        }
      : null,
    employmentStatus: emp.employmentStatus,
    hireDate: emp.hireDate ? emp.hireDate.toISOString().split('T')[0] : null,
    terminationDate: emp.terminationDate ? emp.terminationDate.toISOString().split('T')[0] : null,
    createdAt: emp.createdAt.toISOString(),
    updatedAt: emp.updatedAt.toISOString(),
  };
}

export class EmployeesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listEmployeesQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const { items, total, page, pageSize, hasMore } = await scope.employees.findMany(query);

      const response: ApiResponse<EmployeeDto[]> = {
        data: items.map(formatEmployee),
        meta: {
          requestId,
          total,
          page,
          pageSize,
          hasMore,
        },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = employeeIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const emp = await scope.employees.findById(id);

      // Authorization rule: employee.read permission OR user's own linked profile
      const canRead =
        hasPermission(req.tenantContext!.role, 'employee.read') ||
        (emp.userId !== null && emp.userId === req.user!.id);

      if (!canRead) {
        throw new ForbiddenError("Permission denied: 'employee.read' or own profile required");
      }

      const response: ApiResponse<EmployeeDto> = {
        data: formatEmployee(emp),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const input = createEmployeeSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.employees.create({
        employeeNumber: input.employeeNumber,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        departmentId: input.departmentId,
        positionId: input.positionId,
        managerEmployeeId: input.managerEmployeeId,
        userId: input.userId,
        hireDate: input.hireDate ? new Date(input.hireDate) : null,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'EMPLOYEE_CREATED',
        entityType: 'Employee',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          employeeNumber: created.employeeNumber,
          fullName: created.fullName,
          departmentId: created.departmentId,
          positionId: created.positionId,
        },
      });

      const response: ApiResponse<EmployeeDto> = {
        data: formatEmployee(created),
        meta: { requestId },
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = updateEmployeeSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.employees.update(id, {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        departmentId: input.departmentId,
        positionId: input.positionId,
        managerEmployeeId: input.managerEmployeeId,
        hireDate:
          input.hireDate !== undefined
            ? input.hireDate
              ? new Date(input.hireDate)
              : null
            : undefined,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'EMPLOYEE_UPDATED',
        entityType: 'Employee',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const response: ApiResponse<EmployeeDto> = {
        data: formatEmployee(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = updateEmployeeStatusSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.employees.updateStatus(id, {
        status: input.status,
        terminationDate: input.terminationDate ? new Date(input.terminationDate) : null,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'EMPLOYEE_STATUS_CHANGED',
        entityType: 'Employee',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          newStatus: input.status,
          terminationDate: input.terminationDate,
        },
      });

      const response: ApiResponse<EmployeeDto> = {
        data: formatEmployee(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const employeesController = new EmployeesController();
