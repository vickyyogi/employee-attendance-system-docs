import { Router } from 'express';
import { employeesController } from './employees.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/employees',
  authenticate,
  requireTenantContext,
  requirePermission('employee.read'),
  employeesController.list.bind(employeesController)
);

router.post(
  '/employees',
  authenticate,
  requireTenantContext,
  requirePermission('employee.create'),
  employeesController.create.bind(employeesController)
);

// getById allows employee.read OR own profile - verified in controller
router.get(
  '/employees/:id',
  authenticate,
  requireTenantContext,
  employeesController.getById.bind(employeesController)
);

router.patch(
  '/employees/:id',
  authenticate,
  requireTenantContext,
  requirePermission('employee.update'),
  employeesController.update.bind(employeesController)
);

router.patch(
  '/employees/:id/status',
  authenticate,
  requireTenantContext,
  requirePermission('employee.manage_status'),
  employeesController.updateStatus.bind(employeesController)
);

export { router as employeesRouter };
