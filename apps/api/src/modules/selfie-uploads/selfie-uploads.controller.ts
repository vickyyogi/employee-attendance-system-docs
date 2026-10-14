import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '@prisma/client';
import { createTenantScope } from '../../infrastructure/database/tenant-context';
import { prisma } from '../../infrastructure/database/prisma';
import { recordAuditLog } from '../../infrastructure/audit/audit-service';
import { createSelfieIntentSchema, selfieIdParamSchema } from './selfie-uploads.schema';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error';
import type {
  ApiResponse,
  CreateSelfieUploadIntentResponse,
  CompleteSelfieUploadResponse,
  SignedReadUrlResponse,
  SelfieUploadDto,
} from '@attendance/api-contracts';

function formatSelfieUploadDto(upload: {
  id: string;
  companyId: string;
  userId: string;
  employeeId: string | null;
  objectKey: string;
  originalName: string | null;
  mimeType: string;
  fileSizeBytes: number | null;
  fileHashSha256: string | null;
  status: string;
  uploadUrlExpiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SelfieUploadDto {
  return {
    id: upload.id,
    companyId: upload.companyId,
    userId: upload.userId,
    employeeId: upload.employeeId,
    objectKey: upload.objectKey,
    originalName: upload.originalName,
    mimeType: upload.mimeType,
    fileSizeBytes: upload.fileSizeBytes,
    fileHashSha256: upload.fileHashSha256,
    status: upload.status as SelfieUploadDto['status'],
    uploadUrlExpiresAt: upload.uploadUrlExpiresAt.toISOString(),
    completedAt: upload.completedAt?.toISOString() ?? null,
    createdAt: upload.createdAt.toISOString(),
    updatedAt: upload.updatedAt.toISOString(),
  };
}

export class SelfieUploadsController {
  async createIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const input = createSelfieIntentSchema.parse(req.body);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      // Resolve employee if user has an employee record in this company
      const employee = await prisma.employee.findUnique({
        where: {
          companyId_userId: {
            companyId: context.companyId,
            userId: context.userId,
          },
        },
      });

      const result = await scope.selfieUploads.createIntent({
        userId: context.userId,
        employeeId: employee?.id ?? null,
        mimeType: input.mimeType,
        originalName: input.originalName,
        fileSizeBytes: input.fileSizeBytes,
      });

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'SELFIE_INTENT_CREATED',
        entityType: 'selfie_upload',
        entityId: result.upload.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          mimeType: input.mimeType,
          originalName: input.originalName,
          fileSizeBytes: input.fileSizeBytes,
        },
      });

      const response: ApiResponse<CreateSelfieUploadIntentResponse> = {
        data: {
          uploadId: result.upload.id,
          uploadUrl: result.uploadUrl,
          objectKey: result.upload.objectKey,
          expiresInSeconds: result.expiresInSeconds,
          maxFileSizeBytes: result.maxFileSizeBytes,
          requiredHeaders: result.requiredHeaders,
        },
        meta: { requestId },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = selfieIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const completed = await scope.selfieUploads.complete(id, context.userId);

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'SELFIE_UPLOAD_COMPLETED',
        entityType: 'selfie_upload',
        entityId: completed.id,
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          fileSizeBytes: completed.fileSizeBytes,
          fileHashSha256: completed.fileHashSha256,
        },
      });

      const response: ApiResponse<CompleteSelfieUploadResponse> = {
        data: {
          upload: formatSelfieUploadDto(completed),
          verified: true,
        },
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async getSignedReadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = selfieIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN ||
        context.role === MembershipRole.AUDITOR;

      const result = await scope.selfieUploads.generateSignedReadUrl(
        id,
        context.userId,
        isPrivileged
      );

      // Privileged access to employee selfie must be audited
      if (isPrivileged && result.upload.userId !== context.userId) {
        await recordAuditLog({
          companyId: context.companyId,
          actorUserId: context.userId,
          action: 'SELFIE_READ_ACCESSED',
          entityType: 'selfie_upload',
          entityId: id,
          requestId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            targetUserId: result.upload.userId,
            targetEmployeeId: result.upload.employeeId,
          },
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
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const { id } = selfieIdParamSchema.parse(req.params);
      const context = req.tenantContext!;
      const scope = createTenantScope(context);

      const upload = await scope.selfieUploads.getById(id);

      // Regular employees can only view their own upload metadata
      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN ||
        context.role === MembershipRole.AUDITOR;

      if (!isPrivileged && upload.userId !== context.userId) {
        throw new NotFoundError('Selfie upload not found');
      }

      const response: ApiResponse<SelfieUploadDto> = {
        data: formatSelfieUploadDto(upload),
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  async cleanup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId || (res.getHeader('x-request-id') as string) || 'unknown';
      const context = req.tenantContext!;
      const isPrivileged =
        context.role === MembershipRole.COMPANY_ADMIN ||
        context.role === MembershipRole.HR_ADMIN;

      if (!isPrivileged) {
        throw new ForbiddenError('Only Company Admin or HR Admin can trigger selfie cleanup');
      }

      const scope = createTenantScope(context);
      const result = await scope.selfieUploads.cleanupExpired(24);

      await recordAuditLog({
        companyId: context.companyId,
        actorUserId: context.userId,
        action: 'SELFIE_CLEANUP_EXECUTED',
        entityType: 'selfie_upload',
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { cleanedCount: result.cleanedCount },
      });

      const response: ApiResponse<{ cleanedCount: number }> = {
        data: result,
        meta: { requestId },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const selfieUploadsController = new SelfieUploadsController();
