import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createWorkLocationSchema,
  updateWorkLocationSchema,
  workLocationIdParamSchema,
  listWorkLocationsQuerySchema,
} from './work-locations.schema';
import type { ApiResponse, WorkLocationDto } from '@attendance/api-contracts';

function formatWorkLocation(loc: {
  id: string;
  companyId: string;
  name: string;
  address: string | null;
  latitude: { toNumber: () => number } | number;
  longitude: { toNumber: () => number } | number;
  geofenceRadiusM: number;
  maxGpsAccuracyM: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WorkLocationDto {
  return {
    id: loc.id,
    companyId: loc.companyId,
    name: loc.name,
    address: loc.address,
    latitude: typeof loc.latitude === 'number' ? loc.latitude : loc.latitude.toNumber(),
    longitude: typeof loc.longitude === 'number' ? loc.longitude : loc.longitude.toNumber(),
    geofenceRadiusM: loc.geofenceRadiusM,
    maxGpsAccuracyM: loc.maxGpsAccuracyM,
    isActive: loc.isActive,
    createdAt: loc.createdAt.toISOString(),
    updatedAt: loc.updatedAt.toISOString(),
  };
}

export class WorkLocationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listWorkLocationsQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const locations = await scope.workLocations.findMany(query);

      const response: ApiResponse<WorkLocationDto[]> = {
        data: locations.map(formatWorkLocation),
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
      const { id } = workLocationIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const loc = await scope.workLocations.findById(id);

      const response: ApiResponse<WorkLocationDto> = {
        data: formatWorkLocation(loc),
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
      const input = createWorkLocationSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.workLocations.create(input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'WORK_LOCATION_CREATED',
        entityType: 'WorkLocation',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          name: created.name,
          geofenceRadiusM: created.geofenceRadiusM,
        },
      });

      const response: ApiResponse<WorkLocationDto> = {
        data: formatWorkLocation(created),
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
      const { id } = workLocationIdParamSchema.parse(req.params);
      const input = updateWorkLocationSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const updated = await scope.workLocations.update(id, input);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'WORK_LOCATION_UPDATED',
        entityType: 'WorkLocation',
        entityId: updated.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { changes: input },
      });

      const response: ApiResponse<WorkLocationDto> = {
        data: formatWorkLocation(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const workLocationsController = new WorkLocationsController();
