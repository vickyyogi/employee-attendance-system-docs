import { Router } from 'express';
import { departmentsController } from './departments.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/departments',
  authenticate,
  requireTenantContext,
  requirePermission('department.read'),
  departmentsController.list.bind(departmentsController)
);

router.post(
  '/departments',
  authenticate,
  requireTenantContext,
  requirePermission('department.create'),
  departmentsController.create.bind(departmentsController)
);

router.get(
  '/departments/:id',
  authenticate,
  requireTenantContext,
  requirePermission('department.read'),
  departmentsController.getById.bind(departmentsController)
);

router.patch(
  '/departments/:id',
  authenticate,
  requireTenantContext,
  requirePermission('department.update'),
  departmentsController.update.bind(departmentsController)
);

export { router as departmentsRouter };
