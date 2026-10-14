import { Router } from 'express';
import { shiftsController } from './shifts.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/shifts',
  authenticate,
  requireTenantContext,
  requirePermission('shift.read'),
  shiftsController.list.bind(shiftsController)
);

router.post(
  '/shifts',
  authenticate,
  requireTenantContext,
  requirePermission('shift.create'),
  shiftsController.create.bind(shiftsController)
);

router.get(
  '/shifts/:id',
  authenticate,
  requireTenantContext,
  requirePermission('shift.read'),
  shiftsController.getById.bind(shiftsController)
);

router.patch(
  '/shifts/:id',
  authenticate,
  requireTenantContext,
  requirePermission('shift.update'),
  shiftsController.update.bind(shiftsController)
);

export { router as shiftsRouter };
