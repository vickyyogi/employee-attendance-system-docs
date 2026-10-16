import { Router } from 'express';
import { reportsController } from './reports.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();

router.use(authenticate, requireTenantContext);

router.get(
  '/attendance-summary',
  requirePermission('report.attendance.read'),
  reportsController.getAttendanceSummary.bind(reportsController)
);

router.get(
  '/late-arrivals',
  requirePermission('report.attendance.read'),
  reportsController.getLateArrivals.bind(reportsController)
);

router.post(
  '/attendance-export',
  requirePermission('report.attendance.export'),
  reportsController.exportAttendance.bind(reportsController)
);

export { router as reportsRouter };
