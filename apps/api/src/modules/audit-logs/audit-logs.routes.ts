import { Router } from 'express';
import { auditLogsController } from './audit-logs.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();

router.use(authenticate, requireTenantContext);

router.get(
  '/',
  requirePermission('audit.read'),
  auditLogsController.list.bind(auditLogsController)
);

export { router as auditLogsRouter };
