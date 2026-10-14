import { Router } from 'express';
import { positionsController } from './positions.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/positions',
  authenticate,
  requireTenantContext,
  requirePermission('position.read'),
  positionsController.list.bind(positionsController)
);

router.post(
  '/positions',
  authenticate,
  requireTenantContext,
  requirePermission('position.create'),
  positionsController.create.bind(positionsController)
);

router.get(
  '/positions/:id',
  authenticate,
  requireTenantContext,
  requirePermission('position.read'),
  positionsController.getById.bind(positionsController)
);

router.patch(
  '/positions/:id',
  authenticate,
  requireTenantContext,
  requirePermission('position.update'),
  positionsController.update.bind(positionsController)
);

export { router as positionsRouter };
