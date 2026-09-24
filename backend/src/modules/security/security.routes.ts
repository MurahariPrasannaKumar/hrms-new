import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { audit } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { securityService as s } from './security.service';
import { auditLogQuerySchema, idParamSchema, loginActivityQuerySchema, sessionQuerySchema } from './security.validation';

export const securityRouter = Router();
securityRouter.use(requireAuth, requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'));

securityRouter.get('/audit-logs', requirePermission('audit_logs.read'), validate(auditLogQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await s.auditLogs(req.user!, req.query as never);
    ok(res, items, 'Success', 200, meta);
  }));

securityRouter.get('/login-activity', requirePermission('security.read'), validate(loginActivityQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await s.loginActivity(req.user!, req.query as never);
    ok(res, items, 'Success', 200, meta);
  }));

securityRouter.get('/failed-logins', requirePermission('security.read'), validate(loginActivityQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await s.loginActivity(req.user!, req.query as never, true);
    ok(res, items, 'Success', 200, meta);
  }));

securityRouter.get('/sessions', requirePermission('security.read'), validate(sessionQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await s.sessions(req.user!, req.query as never);
    ok(res, items, 'Success', 200, meta);
  }));

securityRouter.delete('/sessions/:id', requirePermission('security.read'), requirePermission('users.update'), validate(idParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const schoolId = await s.revokeSession(req.user!, req.params.id as string);
    await audit(req, { action: 'REVOKE', resource: 'SESSION', resourceId: req.params.id as string, schoolId });
    ok(res, null, 'Session revoked');
  }));
