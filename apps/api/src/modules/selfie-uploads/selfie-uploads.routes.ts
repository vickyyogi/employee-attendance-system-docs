import { Router } from 'express';
import { selfieUploadsController } from './selfie-uploads.controller';
import { authenticate, requireTenantContext } from '../../common/middleware/auth';

const router = Router();

// All selfie endpoints are tenant-scoped and require authenticated user
router.post(
  '/',
  authenticate,
  requireTenantContext,
  selfieUploadsController.createIntent.bind(selfieUploadsController)
);

router.post(
  '/cleanup',
  authenticate,
  requireTenantContext,
  selfieUploadsController.cleanup.bind(selfieUploadsController)
);

router.get(
  '/:id',
  authenticate,
  requireTenantContext,
  selfieUploadsController.getById.bind(selfieUploadsController)
);

router.post(
  '/:id/complete',
  authenticate,
  requireTenantContext,
  selfieUploadsController.complete.bind(selfieUploadsController)
);

router.get(
  '/:id/signed-url',
  authenticate,
  requireTenantContext,
  selfieUploadsController.getSignedReadUrl.bind(selfieUploadsController)
);

export { router as selfieUploadsRouter };
