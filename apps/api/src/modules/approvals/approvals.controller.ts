import { Request, Response, NextFunction } from 'express';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import type {
  ApiResponse,
  PendingApprovalsResponse,
  LeaveRequestDto,
  AttendanceCorrectionRequestDto,
  LeaveUnit,
  AttendanceStatus,
} from '@attendance/api-contracts';

export class ApprovalsController {
  async listPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = req.tenantContext!;
      const scope = createTenantScope(context);
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 50;

      const result = await scope.approvals.listPending({ page, pageSize });

      const leaveRequests: LeaveRequestDto[] = result.leaveRequests.map((r) => ({
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
        decidedAt: null,
        decidedByUserId: null,
        decidedByUser: null,
        decisionNote: null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const attendanceCorrections: AttendanceCorrectionRequestDto[] =
        result.attendanceCorrections.map((c) => ({
          id: c.id,
          companyId: c.companyId,
          employeeId: c.employeeId,
          employee: c.employee
            ? {
                id: c.employee.id,
                fullName: c.employee.fullName,
                employeeNumber: c.employee.employeeNumber,
              }
            : null,
          attendanceRecordId: c.attendanceRecordId,
          attendanceRecord: c.attendanceRecord
            ? {
                id: c.attendanceRecord.id,
                workDate: c.attendanceRecord.workDate.toISOString().split('T')[0],
                checkInAt: c.attendanceRecord.checkInAt?.toISOString() ?? null,
                checkOutAt: c.attendanceRecord.checkOutAt?.toISOString() ?? null,
                status: c.attendanceRecord.status as AttendanceStatus,
              }
            : null,
          requestedCheckInAt: c.requestedCheckInAt?.toISOString() ?? null,
          requestedCheckOutAt: c.requestedCheckOutAt?.toISOString() ?? null,
          reason: c.reason,
          status: c.status as AttendanceCorrectionRequestDto['status'],
          submittedAt: c.submittedAt.toISOString(),
          decidedAt: null,
          decidedByUserId: null,
          decidedByUser: null,
          decisionNote: null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }));

      const response: ApiResponse<PendingApprovalsResponse> = {
        data: {
          leaveRequests,
          attendanceCorrections,
          total: result.total,
        },
        meta: {
          requestId: req.requestId || (res.getHeader('x-request-id') as string) || 'unknown',
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        },
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  }
}
