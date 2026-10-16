import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '@prisma/client';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  createLeaveRequestSchema,
  approvalDecisionSchema,
  leaveIdParamSchema,
} from './leave.schema';
import type {
  ApiResponse,
  LeaveTypeDto,
  LeaveRequestDto,
  LeaveUnit,
} from '@attendance/api-contracts';

function formatLeaveTypeDto(t: {
  id: string;
  companyId: string;
  name: string;
  unit: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LeaveTypeDto {
  return {
    id: t.id,
    companyId: t.companyId,
    name: t.name,
    unit: t.unit as LeaveTypeDto['unit'],
    requiresApproval: t.requiresApproval,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function formatLeaveRequestDto(r: {
  id: string;
  companyId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; employeeNumber: string } | null;
  leaveTypeId: string;
  leaveType?: { id: string; name: string; unit: string } | null;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: string;
  submittedAt: Date;
  decidedAt: Date | null;
  decidedByUserId: string | null;
  decidedByUser?: { id: string; fullName: string; email: string } | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}): LeaveRequestDto {
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
    leaveTypeId: r.leaveTypeId,
    leaveType: r.leaveType
      ? {
          id: r.leaveType.id,
          name: r.leaveType.name,
          unit: r.leaveType.unit as LeaveUnit,
        }
      : null,
    startDate: r.startDate.toISOString().split('T')[0],
    endDate: r.endDate.toISOString().split('T')[0],
    reason: r.reason,
    status: r.status as LeaveRequestDto['status'],
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

export class LeaveController {
  // Leave Types
  async listTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = req.tenantContext!;
      const scope = createTenantScope(context);
      const types = await scope.leaveTypes.list();
      const response: ApiResponse<LeaveTypeDto[]> = {
        data: types.map(formatLeaveTypeDto),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  async createType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createLeaveTypeSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const created = await scope.leaveTypes.create(input);

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'LEAVE_TYPE_CREATED',
        entityType: 'leave_type',
        entityId: created.id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { name: created.name, unit: created.unit },
      });

      const response: ApiResponse<LeaveTypeDto> = {
        data: formatLeaveTypeDto(created),
      };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  async updateType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = leaveIdParamSchema.parse(req.params);
      const input = updateLeaveTypeSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const updated = await scope.leaveTypes.update(id, input);

      const response: ApiResponse<LeaveTypeDto> = {
        data: formatLeaveTypeDto(updated),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  // Leave Requests
  async createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createLeaveRequestSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const created = await scope.leaveRequests.create({
        userId: context.userId,
        leaveTypeId: input.leaveTypeId,
        startDate: new Date(`${input.startDate}T00:00:00Z`),
        endDate: new Date(`${input.endDate}T00:00:00Z`),
        reason: input.reason,
      });

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'LEAVE_REQUEST_CREATED',
        entityType: 'leave_request',
        entityId: created.id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          leaveTypeId: created.leaveTypeId,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });

      const response: ApiResponse<LeaveRequestDto> = {
        data: formatLeaveRequestDto(created),
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

      const result = await scope.leaveRequests.listOwn({
        userId: context.userId,
        page,
        pageSize,
      });

      const response: ApiResponse<LeaveRequestDto[]> = {
        data: result.records.map(formatLeaveRequestDto),
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
      const { id } = leaveIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN;

      const record = await scope.leaveRequests.getById(id, context.userId, isPrivileged);

      const response: ApiResponse<LeaveRequestDto> = {
        data: formatLeaveRequestDto(record),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  async cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = leaveIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const cancelled = await scope.leaveRequests.cancel(id, context.userId);

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'LEAVE_REQUEST_CANCELLED',
        entityType: 'leave_request',
        entityId: id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const response: ApiResponse<LeaveRequestDto> = {
        data: formatLeaveRequestDto(cancelled),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  async decideRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = leaveIdParamSchema.parse(req.params);
      const input = approvalDecisionSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const updated = await scope.leaveRequests.decide(
        id,
        context.userId,
        input.decision,
        input.note
      );

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: input.decision === 'APPROVED' ? 'LEAVE_REQUEST_APPROVED' : 'LEAVE_REQUEST_REJECTED',
        entityType: 'leave_request',
        entityId: id,
        requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          decision: input.decision,
          note: input.note,
        },
      });

      const response: ApiResponse<LeaveRequestDto> = {
        data: formatLeaveRequestDto(updated),
      };
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
