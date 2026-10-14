import { Router } from 'express';
import { holidaysController } from './holidays.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get(
  '/holidays',
  authenticate,
  requireTenantContext,
  requirePermission('holiday.read'),
  holidaysController.list.bind(holidaysController)
);

router.post(
  '/holidays',
  authenticate,
  requireTenantContext,
  requirePermission('holiday.create'),
  holidaysController.create.bind(holidaysController)
);

router.get(
  '/holidays/:id',
  authenticate,
  requireTenantContext,
  requirePermission('holiday.read'),
  holidaysController.getById.bind(holidaysController)
);

router.patch(
  '/holidays/:id',
  authenticate,
  requireTenantContext,
  requirePermission('holiday.update'),
  holidaysController.update.bind(holidaysController)
);

router.delete(
  '/holidays/:id',
  authenticate,
  requireTenantContext,
  requirePermission('holiday.update'),
  holidaysController.delete.bind(holidaysController)
);

export { router as holidaysRouter };
