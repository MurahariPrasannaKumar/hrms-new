import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { authController as c } from './auth.controller';
import {
  changePasswordSchema, forgotPasswordSchema, loginSchema, refreshSchema, resetPasswordSchema,
} from './auth.validation';

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] } },
});

export const authRouter = Router();
authRouter.use(authLimiter);
authRouter.post('/login', validate(loginSchema), asyncHandler(c.login));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler(c.refresh));
authRouter.post('/logout', asyncHandler(c.logout));
authRouter.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(c.forgotPassword));
authRouter.post('/reset-password', validate(resetPasswordSchema), asyncHandler(c.resetPassword));
// Passwords are managed by admins; only admin roles may change their own.
authRouter.post('/change-password', requireAuth, requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'), validate(changePasswordSchema), asyncHandler(c.changePassword));
authRouter.get('/me', requireAuth, asyncHandler(c.me));
