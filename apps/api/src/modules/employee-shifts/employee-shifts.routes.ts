import { Router } from 'express';
import { employeeShiftsController } from './employee-shifts.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/employee-shifts',
  authenticate,
  requireTenantContext,
  requirePermission('shift.read'),
  employeeShiftsController.list.bind(employeeShiftsController)
);

router.post(
  '/employee-shifts',
  authenticate,
  requireTenantContext,
  requirePermission('shift.assign'),
  employeeShiftsController.create.bind(employeeShiftsController)
);

router.get(
  '/employee-shifts/:id',
  authenticate,
  requireTenantContext,
  requirePermission('shift.read'),
  employeeShiftsController.getById.bind(employeeShiftsController)
);

router.delete(
  '/employee-shifts/:id',
  authenticate,
  requireTenantContext,
  requirePermission('shift.assign'),
  employeeShiftsController.delete.bind(employeeShiftsController)
);

export { router as employeeShiftsRouter };
