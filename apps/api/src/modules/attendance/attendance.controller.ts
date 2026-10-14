import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '@prisma/client';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  checkInSchema,
  checkOutSchema,
  flagAttendanceSchema,
  attendanceIdParamSchema,
  attendanceSelfieParamSchema,
  listAttendanceQuerySchema,
} from './attendance.schema';
import type {
  ApiResponse,
  AttendanceRecordDto,
  SignedReadUrlResponse,
} from '@attendance/api-contracts';

function formatAttendanceRecord(record: {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeNumber: string } | null;
  workDate: Date;
  shiftId: string | null;
  shift?: { id: string; name: string; startTimeLocal: string; endTimeLocal: string } | null;
  workLocationId: string | null;
  workLocation?: { id: string; name: string } | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInLatitude: { toNumber: () => number } | number | null;
  checkInLongitude: { toNumber: () => number } | number | null;
  checkInAccuracyM: number | null;
  checkInDistanceM: number | null;
  checkInGeofenceValid: boolean | null;
  checkInSelfieObjectKey: string | null;
  checkOutLatitude: { toNumber: () => number } | number | null;
  checkOutLongitude: { toNumber: () => number } | number | null;
  checkOutAccuracyM: number | null;
  checkOutDistanceM: number | null;
  checkOutGeofenceValid: boolean | null;
  checkOutSelfieObjectKey: string | null;
  status: string;
  idempotencyKey: string | null;
  flagReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AttendanceRecordDto {
  const toNum = (val: { toNumber: () => number } | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    return typeof val === 'number' ? val : val.toNumber();
  };

  return {
    id: record.id,
    companyId: record.companyId,
    employeeId: record.employeeId,
    employee: record.employee
      ? {
          id: record.employee.id,
          fullName: record.employee.fullName,
          employeeNumber: record.employee.employeeNumber,
        }
      : null,
    workDate: record.workDate.toISOString().split('T')[0],
    shiftId: record.shiftId,
    shift: record.shift
      ? {
          id: record.shift.id,
          name: record.shift.name,
          startTimeLocal: record.shift.startTimeLocal,
          endTimeLocal: record.shift.endTimeLocal,
        }
      : null,
    workLocationId: record.workLocationId,
    workLocation: record.workLocation
      ? {
          id: record.workLocation.id,
          name: record.workLocation.name,
        }
      : null,
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    checkInLatitude: toNum(record.checkInLatitude),
    checkInLongitude: toNum(record.checkInLongitude),
    checkInAccuracyM: record.checkInAccuracyM,
    checkInDistanceM: record.checkInDistanceM,
    checkInGeofenceValid: record.checkInGeofenceValid,
    checkInSelfieObjectKey: record.checkInSelfieObjectKey,
    checkOutLatitude: toNum(record.checkOutLatitude),
    checkOutLongitude: toNum(record.checkOutLongitude),
    checkOutAccuracyM: record.checkOutAccuracyM,
    checkOutDistanceM: record.checkOutDistanceM,
    checkOutGeofenceValid: record.checkOutGeofenceValid,
    checkOutSelfieObjectKey: record.checkOutSelfieObjectKey,
    status: record.status as AttendanceRecordDto['status'],
    idempotencyKey: record.idempotencyKey,
    flagReason: record.flagReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class AttendanceController {
  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const input = checkInSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const record = await scope.attendance.checkIn({
        userId: context.userId,
        workLocationId: input.workLocationId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM: input.accuracyM,
        selfieUploadId: input.selfieUploadId,
        idempotencyKey: input.idempotencyKey,
      });

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'ATTENDANCE_CHECKED_IN',
        entityType: 'attendance_record',
        entityId: record.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          employeeId: record.employeeId,
          workLocationId: record.workLocationId,
          status: record.status,
          distanceM: record.checkInDistanceM,
        },
      });

      const response: ApiResponse<AttendanceRecordDto> = {
        data: formatAttendanceRecord(record),
        meta: { requestId },
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async checkOut(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const input = checkOutSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const record = await scope.attendance.checkOut({
        userId: context.userId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM: input.accuracyM,
        selfieUploadId: input.selfieUploadId,
        workLocationId: input.workLocationId,
        idempotencyKey: input.idempotencyKey,
      });

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'ATTENDANCE_CHECKED_OUT',
        entityType: 'attendance_record',
        entityId: record.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          employeeId: record.employeeId,
          status: record.status,
          checkOutAt: record.checkOutAt,
        },
      });

      const response: ApiResponse<AttendanceRecordDto> = {
        data: formatAttendanceRecord(record),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getToday(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const record = await scope.attendance.getToday(context.userId);

      const response: ApiResponse<AttendanceRecordDto | null> = {
        data: record ? formatAttendanceRecord(record) : null,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getMine(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const records = await scope.attendance.getMine(context.userId);

      const response: ApiResponse<AttendanceRecordDto[]> = {
        data: records.map(formatAttendanceRecord),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = listAttendanceQuerySchema.parse(req.query);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const result = await scope.attendance.search(query);

      const response: ApiResponse<AttendanceRecordDto[]> = {
        data: result.records.map(formatAttendanceRecord),
        meta: {
          requestId,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          hasMore: result.page * result.pageSize < result.total,
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
      const { id } = attendanceIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN ||
        context.role === MembershipRole.AUDITOR;

      const record = await scope.attendance.getById(id, context.userId, isPrivileged);

      const response: ApiResponse<AttendanceRecordDto> = {
        data: formatAttendanceRecord(record),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async flag(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = attendanceIdParamSchema.parse(req.params);
      const input = flagAttendanceSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const updated = await scope.attendance.flag(id, input.reason, context.userId);

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'ATTENDANCE_FLAGGED',
        entityType: 'attendance_record',
        entityId: id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { reason: input.reason },
      });

      const response: ApiResponse<AttendanceRecordDto> = {
        data: formatAttendanceRecord(updated),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getSelfieUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id, kind } = attendanceSelfieParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN ||
        context.role === MembershipRole.AUDITOR;

      const result = await scope.attendance.getSignedSelfieUrl(
        id,
        kind,
        context.userId,
        isPrivileged
      );

      if (isPrivileged && result.record.employee.userId !== context.userId) {
        await recordAuditLog({
          companyId: context.companyId,
          actorUserId: context.userId,
          action: 'SELFIE_READ_ACCESSED',
          entityType: 'attendance_record',
          entityId: id,
          requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { kind, targetUserId: result.record.employee.userId },
        });
      }

      const response: ApiResponse<SignedReadUrlResponse> = {
        data: {
          readUrl: result.readUrl,
          expiresInSeconds: result.expiresInSeconds,
          objectKey: result.objectKey,
        },
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const attendanceController = new AttendanceController();
