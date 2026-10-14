import { Router } from 'express';
import { companiesController } from './companies.controller';
import { authenticate, requireTenantContext, requirePermission } from '../../common/middleware/auth';

const router = Router();

router.get('/companies', authenticate, (req, res, next) =>
  companiesController.listUserCompanies(req, res, next)
);

router.get(
  '/companies/:companyId',
  authenticate,
  requireTenantContext,
  requirePermission('company.read'),
  (req, res, next) => companiesController.getCompanyById(req, res, next)
);

export { router as companiesRouter };
