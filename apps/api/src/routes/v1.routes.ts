import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { companiesRouter } from '../modules/companies/companies.routes';
import { departmentsRouter } from '../modules/departments/departments.routes';
import { positionsRouter } from '../modules/positions/positions.routes';
import { employeesRouter } from '../modules/employees/employees.routes';
import { workLocationsRouter } from '../modules/work-locations/work-locations.routes';
import { shiftsRouter } from '../modules/shifts/shifts.routes';
import { employeeShiftsRouter } from '../modules/employee-shifts/employee-shifts.routes';
import { holidaysRouter } from '../modules/holidays/holidays.routes';
import { selfieUploadsRouter } from '../modules/selfie-uploads/selfie-uploads.routes';
import { storageRouter } from '../modules/storage/storage.routes';
import { attendanceRouter } from '../modules/attendance/attendance.routes';
import { leaveRouter } from '../modules/leave/leave.routes';
import { attendanceCorrectionsRouter } from '../modules/attendance-corrections/attendance-corrections.routes';
import { approvalsRouter } from '../modules/approvals/approvals.routes';
import { reportsRouter } from '../modules/reports/reports.routes';
import { auditLogsRouter } from '../modules/audit-logs/audit-logs.routes';

const router = Router();

// Mount modules
router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(departmentsRouter);
router.use(positionsRouter);
router.use(employeesRouter);
router.use(workLocationsRouter);
router.use(shiftsRouter);
router.use(employeeShiftsRouter);
router.use(holidaysRouter);
router.use('/attendance/selfie-uploads', selfieUploadsRouter);
router.use('/storage', storageRouter);
router.use('/attendance', attendanceRouter);
router.use(leaveRouter);
router.use(attendanceCorrectionsRouter);
router.use(approvalsRouter);
router.use('/reports', reportsRouter);
router.use('/audit-logs', auditLogsRouter);

export { router as v1Router };
