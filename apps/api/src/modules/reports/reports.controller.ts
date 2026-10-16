import { Request, Response, NextFunction } from 'express';
import {
  attendanceSummaryQuerySchema,
  lateArrivalsQuerySchema,
  attendanceExportSchema,
} from './reports.schema';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import type {
  ApiResponse,
  AttendanceSummaryReportDto,
  LateArrivalReportDto,
  AttendanceExportResponse,
} from '@attendance/api-contracts';

export class ReportsController {
  async getAttendanceSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = attendanceSummaryQuerySchema.parse(req.query);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const report = await scope.reports.getAttendanceSummary(query.startDate, query.endDate);

      const response: ApiResponse<AttendanceSummaryReportDto> = {
        data: report,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async getLateArrivals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = lateArrivalsQuerySchema.parse(req.query);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const report = await scope.reports.getLateArrivals(query.startDate, query.endDate, query.limit);

      const response: ApiResponse<LateArrivalReportDto> = {
        data: report,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  async exportAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const input = attendanceExportSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const result = await scope.reports.exportAttendance(
        input,
        context.userId,
        {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          requestId,
        }
      );

      const response: ApiResponse<AttendanceExportResponse> = {
        data: result,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
