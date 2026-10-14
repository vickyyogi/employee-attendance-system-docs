import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createShiftSchema,
  updateShiftSchema,
  shiftIdParamSchema,
  listShiftsQuerySchema,
} from './shifts.schema';
import type { ApiResponse, ShiftDto } from '@attendance/api-contracts';

function formatShift(shift: {
  id: string;
  companyId: string;
  name: string;
  startTimeLocal: string;
  endTimeLocal: string;
  crossesMidnight: boolean;
  gracePeriodMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ShiftDto {
  return {
    id: shift.id,
    companyId: shift.companyId,
    name: shift.name,
    startTimeLocal: shift.startTimeLocal,
    endTimeLocal: shift.endTimeLocal,
    crossesMidnight: shift.crossesMidnight,
    gracePeriodMinutes: shift.gracePeriodMinutes,
    isActive: shift.isActive,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
  };
}

export class ShiftsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listShiftsQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const shifts = await scope.shifts.findMany(query);

      const response: ApiResponse<ShiftDto[]> = {
        data: shifts.map(formatShift),
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
      const { id } = shiftIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const shift = await scope.shifts.findById(id);

      const response: ApiResponse<ShiftDto> = {
        data: formatShift(shift),
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
      const input = createShiftSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.shifts.create(input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'SHIFT_CREATED',
        entityType: 'Shift',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          name: created.name,
          startTimeLocal: created.startTimeLocal,
          endTimeLocal: created.endTimeLocal,
          crossesMidnight: created.crossesMidnight,
        },
      });

      const response: ApiResponse<ShiftDto> = {
        data: formatShift(created),
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
      const { id } = shiftIdParamSchema.parse(req.params);
      const input = updateShiftSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.shifts.update(id, input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'SHIFT_UPDATED',
        entityType: 'Shift',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const response: ApiResponse<ShiftDto> = {
        data: formatShift(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const shiftsController = new ShiftsController();
