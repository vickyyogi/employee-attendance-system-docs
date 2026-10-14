import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createHolidaySchema,
  updateHolidaySchema,
  holidayIdParamSchema,
  listHolidaysQuerySchema,
} from './holidays.schema';
import type { ApiResponse, HolidayDto } from '@attendance/api-contracts';

function formatHoliday(h: {
  id: string;
  companyId: string;
  date: Date;
  name: string;
  createdAt: Date;
}): HolidayDto {
  return {
    id: h.id,
    companyId: h.companyId,
    date: h.date.toISOString().split('T')[0],
    name: h.name,
    createdAt: h.createdAt.toISOString(),
  };
}

export class HolidaysController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listHolidaysQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const holidays = await scope.holidays.findMany(query);

      const response: ApiResponse<HolidayDto[]> = {
        data: holidays.map(formatHoliday),
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
      const { id } = holidayIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const holiday = await scope.holidays.findById(id);

      const response: ApiResponse<HolidayDto> = {
        data: formatHoliday(holiday),
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
      const input = createHolidaySchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.holidays.create({
        date: new Date(input.date),
        name: input.name,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'HOLIDAY_CREATED',
        entityType: 'Holiday',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          name: created.name,
          date: input.date,
        },
      });

      const response: ApiResponse<HolidayDto> = {
        data: formatHoliday(created),
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
      const { id } = holidayIdParamSchema.parse(req.params);
      const input = updateHolidaySchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.holidays.update(id, {
        date: input.date ? new Date(input.date) : undefined,
        name: input.name,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'HOLIDAY_UPDATED',
        entityType: 'Holiday',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const response: ApiResponse<HolidayDto> = {
        data: formatHoliday(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = holidayIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      await scope.holidays.delete(id);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'HOLIDAY_DELETED',
        entityType: 'Holiday',
        entityId: id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const response: ApiResponse<{ success: true }> = {
        data: { success: true },
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const holidaysController = new HolidaysController();
