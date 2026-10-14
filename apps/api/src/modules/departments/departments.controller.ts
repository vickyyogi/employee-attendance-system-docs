import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
  listDepartmentsQuerySchema,
} from './departments.schema';
import type { ApiResponse, DepartmentDto } from '@attendance/api-contracts';

export class DepartmentsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listDepartmentsQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const departments = await scope.departments.findMany(query);

      const data: DepartmentDto[] = departments.map((d) => ({
        id: d.id,
        companyId: d.companyId,
        name: d.name,
        code: d.code,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      }));

      const response: ApiResponse<DepartmentDto[]> = {
        data,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = departmentIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const d = await scope.departments.findById(id);

      const data: DepartmentDto = {
        id: d.id,
        companyId: d.companyId,
        name: d.name,
        code: d.code,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      };

      const response: ApiResponse<DepartmentDto> = {
        data,
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
      const input = createDepartmentSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.departments.create(input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'DEPARTMENT_CREATED',
        entityType: 'Department',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { name: created.name, code: created.code },
      });

      const data: DepartmentDto = {
        id: created.id,
        companyId: created.companyId,
        name: created.name,
        code: created.code,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };

      const response: ApiResponse<DepartmentDto> = {
        data,
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
      const { id } = departmentIdParamSchema.parse(req.params);
      const input = updateDepartmentSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.departments.update(id, input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'DEPARTMENT_UPDATED',
        entityType: 'Department',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const data: DepartmentDto = {
        id: updated.id,
        companyId: updated.companyId,
        name: updated.name,
        code: updated.code,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };

      const response: ApiResponse<DepartmentDto> = {
        data,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const departmentsController = new DepartmentsController();
