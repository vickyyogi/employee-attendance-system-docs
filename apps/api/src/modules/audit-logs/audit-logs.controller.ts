import { Request, Response, NextFunction } from 'express';
import { auditLogsQuerySchema } from './audit-logs.schema';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import type { ApiResponse, AuditLogDto } from '@attendance/api-contracts';

export class AuditLogsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const query = auditLogsQuerySchema.parse(req.query);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const result = await scope.auditLogs.search(query);

      const formattedLogs: AuditLogDto[] = result.logs.map((log) => ({
        id: log.id,
        companyId: log.companyId,
        actorUserId: log.actorUserId,
        actorUser: log.actor
          ? {
              id: log.actor.id,
              fullName: log.actor.fullName,
              email: log.actor.email,
            }
          : null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        requestId: log.requestId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt.toISOString(),
      }));

      const response: ApiResponse<AuditLogDto[]> = {
        data: formattedLogs,
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
}

export const auditLogsController = new AuditLogsController();
