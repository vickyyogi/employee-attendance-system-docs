import { Router } from 'express';
import { AttendanceCorrectionsController } from './attendance-corrections.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();
const controller = new AttendanceCorrectionsController();

router.get(
  '/attendance-correction-requests',
  authenticate,
  requireTenantContext,
  requirePermission('attendance_correction.create_own'),
  controller.listOwnRequests.bind(controller)
);

router.post(
  '/attendance-correction-requests',
  authenticate,
  requireTenantContext,
  requirePermission('attendance_correction.create_own'),
  controller.createRequest.bind(controller)
);

router.get(
  '/attendance-correction-requests/:id',
  authenticate,
  requireTenantContext,
  controller.getRequestById.bind(controller)
);

router.post(
  '/attendance-correction-requests/:id/decision',
  authenticate,
  requireTenantContext,
  requirePermission('attendance_correction.approve'),
  controller.decideRequest.bind(controller)
);

export { router as attendanceCorrectionsRouter };
