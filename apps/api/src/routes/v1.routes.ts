import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { companiesRouter } from '../modules/companies/companies.routes';

const router = Router();

// Mount modules
router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);

export { router as v1Router };
