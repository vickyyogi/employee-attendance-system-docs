import { Router } from 'express';
import { workLocationsController } from './work-locations.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/work-locations',
  authenticate,
  requireTenantContext,
  requirePermission('location.read'),
  workLocationsController.list.bind(workLocationsController)
);

router.post(
  '/work-locations',
  authenticate,
  requireTenantContext,
  requirePermission('location.create'),
  workLocationsController.create.bind(workLocationsController)
);

router.get(
  '/work-locations/:id',
  authenticate,
  requireTenantContext,
  requirePermission('location.read'),
  workLocationsController.getById.bind(workLocationsController)
);

router.patch(
  '/work-locations/:id',
  authenticate,
  requireTenantContext,
  requirePermission('location.update'),
  workLocationsController.update.bind(workLocationsController)
);

export { router as workLocationsRouter };
