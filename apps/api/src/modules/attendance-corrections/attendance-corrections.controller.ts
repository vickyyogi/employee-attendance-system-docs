import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '@prisma/client';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createCorrectionRequestSchema,
  correctionDecisionSchema,
  correctionIdParamSchema,
} from './attendance-corrections.schema';
import type {
  ApiResponse,
  AttendanceCorrectionRequestDto,
  AttendanceStatus,
} from '@attendance/api-contracts';

function formatCorrectionDto(r: {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeNumber: string } | null;
  attendanceRecordId: string | null;
  attendanceRecord?: {
    id: string;
    workDate: Date;
    checkInAt: Date | null;
    checkOutAt: Date | null;
    status: string;
  } | null;
  requestedCheckInAt: Date | null;
  requestedCheckOutAt: Date | null;
  reason: string;
  status: string;
  submittedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decidedByUser?: { id: string; fullName: string; email: string } | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AttendanceCorrectionRequestDto {
  return {
    id: r.id,
    companyId: r.companyId,
    employeeId: r.employeeId,
    employee: r.employee
      ? {
          id: r.employee.id,
          fullName: r.employee.fullName,
          employeeNumber: r.employee.employeeNumber,
        }
      : null,
    attendanceRecordId: r.attendanceRecordId,
    attendanceRecord: r.attendanceRecord
      ? {
          id: r.attendanceRecord.id,
          workDate: r.attendanceRecord.workDate.toISOString().split('T')[0],
          checkInAt: r.attendanceRecord.checkInAt?.toISOString() ?? null,
          checkOutAt: r.attendanceRecord.checkOutAt?.toISOString() ?? null,
          status: r.attendanceRecord.status as AttendanceStatus,
        }
      : null,
    requestedCheckInAt: r.requestedCheckInAt?.toISOString() ?? null,
    requestedCheckOutAt: r.requestedCheckOutAt?.toISOString() ?? null,
    reason: r.reason,
    status: r.status as AttendanceCorrectionRequestDto['status'],
    submittedAt: r.submittedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    decidedByUserId: r.decidedByUserId,
    decidedByUser: r.decidedByUser
      ? {
          id: r.decidedByUser.id,
          fullName: r.decidedByUser.fullName,
          email: r.decidedByUser.email,
        }
      : null,
    decisionNote: r.decisionNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export class AttendanceCorrectionsController {
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createCorrectionRequestSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const created = await scope.attendanceCorrections.create({
        userId: context.userId,
        attendanceRecordId: input.attendanceRecordId,
        requestedCheckInAt: input.requestedCheckInAt ? new Date(input.requestedCheckInAt) : undefined,
        requestedCheckOutAt: input.requestedCheckOutAt ? new Date(input.requestedCheckOutAt) : undefined,
        reason: input.reason,
      });

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'ATTENDANCE_CORRECTION_CREATED',
        entityType: 'attendance_correction_request',
        entityId: created.id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          attendanceRecordId: input.attendanceRecordId,
          requestedCheckInAt: input.requestedCheckInAt,
          requestedCheckOutAt: input.requestedCheckOutAt,
        },
      });

      const response: ApiResponse<AttendanceCorrectionRequestDto> = {
        data: formatCorrectionDto(created),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async listOwnRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = req.tenantContext!;
      const scope = createTenantScope(context);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

      const result = await scope.attendanceCorrections.listOwn({
        userId: context.userId,
        page,
        pageSize,
      });

      const response: ApiResponse<AttendanceCorrectionRequestDto[]> = {
        data: result.records.map(formatCorrectionDto),
        meta: {
          requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          hasMore: result.page * result.pageSize < result.total,
        },
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  async getRequestById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = correctionIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN;

      const record = await scope.attendanceCorrections.getById(id, context.userId, isPrivileged);

      const response: ApiResponse<AttendanceCorrectionRequestDto> = {
        data: formatCorrectionDto(record),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  async decideRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = correctionIdParamSchema.parse(req.params);
      const input = correctionDecisionSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const updated = await scope.attendanceCorrections.decide(
        id,
        context.userId,
        input.decision,
        input.note
      );

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action:
          input.decision === 'APPROVED'
            ? 'ATTENDANCE_CORRECTION_APPROVED'
            : 'ATTENDANCE_CORRECTION_REJECTED',
        entityType: 'attendance_correction_request',
        entityId: id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          decision: input.decision,
          note: input.note,
        },
      });

      const response: ApiResponse<AttendanceCorrectionRequestDto> = {
        data: formatCorrectionDto(updated),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
