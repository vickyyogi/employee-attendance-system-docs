import { Router } from 'express';
import { LeaveController } from './leave.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();
const controller = new LeaveController();

// Leave Types
router.get(
  '/leave-types',
  authenticate,
  requireTenantContext,
  controller.listTypes.bind(controller)
);

router.post(
  '/leave-types',
  authenticate,
  requireTenantContext,
  requirePermission('settings.update'),
  controller.createType.bind(controller)
);

router.patch(
  '/leave-types/:id',
  authenticate,
  requireTenantContext,
  requirePermission('settings.update'),
  controller.updateType.bind(controller)
);

// Leave Requests
router.get(
  '/leave-requests',
  authenticate,
  requireTenantContext,
  requirePermission('leave.read_own'),
  controller.listOwnRequests.bind(controller)
);

router.post(
  '/leave-requests',
  authenticate,
  requireTenantContext,
  requirePermission('leave.create'),
  controller.createRequest.bind(controller)
);

router.get(
  '/leave-requests/:id',
  authenticate,
  requireTenantContext,
  controller.getRequestById.bind(controller)
);

router.post(
  '/leave-requests/:id/cancel',
  authenticate,
  requireTenantContext,
  requirePermission('leave.cancel_own'),
  controller.cancelRequest.bind(controller)
);

router.post(
  '/leave-requests/:id/decision',
  authenticate,
  requireTenantContext,
  requirePermission('leave.approve'),
  controller.decideRequest.bind(controller)
);

export { router as leaveRouter };
