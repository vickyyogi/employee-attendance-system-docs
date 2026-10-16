import { Router } from 'express';
import { ApprovalsController } from './approvals.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();
const controller = new ApprovalsController();

router.get(
  '/approvals/pending',
  authenticate,
  requireTenantContext,
  requirePermission('approval.read_pending'),
  controller.listPending.bind(controller)
);

export { router as approvalsRouter };
