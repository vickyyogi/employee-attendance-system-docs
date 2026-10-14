import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { companiesRouter } from '../modules/companies/companies.routes';
import { departmentsRouter } from '../modules/departments/departments.routes';
import { positionsRouter } from '../modules/positions/positions.routes';
import { employeesRouter } from '../modules/employees/employees.routes';

const router = Router();

// Mount modules
router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(departmentsRouter);
router.use(positionsRouter);
router.use(employeesRouter);

export { router as v1Router };
