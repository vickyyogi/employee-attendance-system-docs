import { Router } from 'express';
import { attendanceController } from './attendance.controller';
import {
  authenticate,
  requireTenantContext,
  requirePermission,
} from '../../common/middleware/auth';

const router = Router();

// Scoped to /attendance
router.use(authenticate, requireTenantContext);

// 1. Current user own attendance endpoints
router.get('/today', attendanceController.getToday.bind(attendanceController));

router.post(
  '/check-in',
  requirePermission('attendance.check_in'),
  attendanceController.checkIn.bind(attendanceController)
);

router.post(
  '/check-out',
  requirePermission('attendance.check_out'),
  attendanceController.checkOut.bind(attendanceController)
);

router.get(
  '/mine',
  requirePermission('attendance.read_own'),
  attendanceController.getMine.bind(attendanceController)
);

// 2. Tenant attendance search (for HR, admin, auditor)
router.get(
  '/',
  requirePermission('attendance.read_all'),
  attendanceController.list.bind(attendanceController)
);

// 3. Detail, flag, and selfie read endpoints
router.get('/:id', attendanceController.getById.bind(attendanceController));

router.post(
  '/:id/flag',
  requirePermission('attendance.flag'),
  attendanceController.flag.bind(attendanceController)
);

router.get('/:id/selfie/:kind', attendanceController.getSelfieUrl.bind(attendanceController));

export { router as attendanceRouter };
