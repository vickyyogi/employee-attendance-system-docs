import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createPositionSchema,
  updatePositionSchema,
  positionIdParamSchema,
  listPositionsQuerySchema,
} from './positions.schema';
import type { ApiResponse, PositionDto } from '@attendance/api-contracts';

export class PositionsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listPositionsQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const positions = await scope.positions.findMany(query);

      const data: PositionDto[] = positions.map((p) => ({
        id: p.id,
        companyId: p.companyId,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      const response: ApiResponse<PositionDto[]> = {
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
      const { id } = positionIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const p = await scope.positions.findById(id);

      const data: PositionDto = {
        id: p.id,
        companyId: p.companyId,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };

      const response: ApiResponse<PositionDto> = {
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
      const input = createPositionSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.positions.create(input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'POSITION_CREATED',
        entityType: 'Position',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { name: created.name },
      });

      const data: PositionDto = {
        id: created.id,
        companyId: created.companyId,
        name: created.name,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };

      const response: ApiResponse<PositionDto> = {
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
      const { id } = positionIdParamSchema.parse(req.params);
      const input = updatePositionSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.positions.update(id, input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'POSITION_UPDATED',
        entityType: 'Position',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const data: PositionDto = {
        id: updated.id,
        companyId: updated.companyId,
        name: updated.name,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };

      const response: ApiResponse<PositionDto> = {
        data,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const positionsController = new PositionsController();
