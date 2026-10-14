import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../common/middleware/auth';
import { createRateLimiter } from '../../common/middleware/rate-limiter';

const router = Router();

// Rate limiter for authentication attempts (e.g. 5 attempts per minute)
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later',
});

router.post('/auth/login', authLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/auth/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/auth/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/auth/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
router.post(
  '/auth/active-company',
  authenticate,
  (req, res, next) => authController.selectActiveCompany(req, res, next)
);

export { router as authRouter };
