import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createEmployeeShiftSchema,
  employeeShiftIdParamSchema,
  listEmployeeShiftsQuerySchema,
} from './employee-shifts.schema';
import type { ApiResponse, EmployeeShiftDto } from '@attendance/api-contracts';

function formatEmployeeShift(es: {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeNumber: string } | null;
  shiftId: string;
  shift?: {
    id: string;
    name: string;
    startTimeLocal: string;
    endTimeLocal: string;
    crossesMidnight: boolean;
    gracePeriodMinutes: number;
  } | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmployeeShiftDto {
  return {
    id: es.id,
    companyId: es.companyId,
    employeeId: es.employeeId,
    employee: es.employee
      ? {
          id: es.employee.id,
          fullName: es.employee.fullName,
          employeeNumber: es.employee.employeeNumber,
        }
      : null,
    shiftId: es.shiftId,
    shift: es.shift
      ? {
          id: es.shift.id,
          name: es.shift.name,
          startTimeLocal: es.shift.startTimeLocal,
          endTimeLocal: es.shift.endTimeLocal,
          crossesMidnight: es.shift.crossesMidnight,
          gracePeriodMinutes: es.shift.gracePeriodMinutes,
        }
      : null,
    effectiveFrom: es.effectiveFrom.toISOString().split('T')[0],
    effectiveTo: es.effectiveTo ? es.effectiveTo.toISOString().split('T')[0] : null,
    createdAt: es.createdAt.toISOString(),
    updatedAt: es.updatedAt.toISOString(),
  };
}

export class EmployeeShiftsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listEmployeeShiftsQuerySchema.parse(req.query);
      const scope = createTenantScope(req.tenantContext!);

      const assignments = await scope.employeeShifts.findMany({
        employeeId: query.employeeId,
        shiftId: query.shiftId,
        effectiveDate: query.effectiveDate ? new Date(query.effectiveDate) : undefined,
      });

      const response: ApiResponse<EmployeeShiftDto[]> = {
        data: assignments.map(formatEmployeeShift),
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
      const { id } = employeeShiftIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      const assignment = await scope.employeeShifts.findById(id);

      const response: ApiResponse<EmployeeShiftDto> = {
        data: formatEmployeeShift(assignment),
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
      const input = createEmployeeShiftSchema.parse(req.body);
      const scope = createTenantScope(req.tenantContext!);

      const created = await scope.employeeShifts.create({
        employeeId: input.employeeId,
        shiftId: input.shiftId,
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      });

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'EMPLOYEE_SHIFT_ASSIGNED',
        entityType: 'EmployeeShift',
        entityId: created.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          employeeId: created.employeeId,
          shiftId: created.shiftId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
        },
      });

      const response: ApiResponse<EmployeeShiftDto> = {
        data: formatEmployeeShift(created),
        meta: { requestId },
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = employeeShiftIdParamSchema.parse(req.params);
      const scope = createTenantScope(req.tenantContext!);

      await scope.employeeShifts.delete(id);

      await recordAuditLog({
        companyId: req.tenantContext!.companyId,
        actorUserId: req.user!.id,
        action: 'EMPLOYEE_SHIFT_REMOVED',
        entityType: 'EmployeeShift',
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

export const employeeShiftsController = new EmployeeShiftsController();
