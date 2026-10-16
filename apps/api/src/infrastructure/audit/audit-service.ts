import { prisma } from '../database/prisma';
import { logger } from '../logger/logger';

export interface RecordAuditParams {
  companyId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export const REDACTED_AUDIT_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'secret',
  'cookie',
  'credential',
  'jwt',
  'apikey',
  'privatekey',
  'bearer',
  'selfie',
]);

export function sanitizeAuditMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (REDACTED_AUDIT_KEYS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object'
          ? sanitizeAuditMetadata(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? null,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        requestId: params.requestId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent?.substring(0, 255) ?? null,
        metadata: sanitizeAuditMetadata(params.metadata) as object | undefined,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', {
      error: err instanceof Error ? err.message : String(err),
      action: params.action,
    });
  }
}
