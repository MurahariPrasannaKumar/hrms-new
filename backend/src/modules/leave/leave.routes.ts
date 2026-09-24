import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { audit } from '../../utils/audit';
import { asyncHandler, ok } from '../../utils/http';
import { schoolWhere } from '../common/tenant-scope';
import { leaveService } from './leave.service';
import { applyLeaveSchema, idParamSchema, listLeaveSchema, listMyLeaveSchema, reviewLeaveSchema } from './leave.validation';

export const leaveRouter = Router();
leaveRouter.use(requireAuth);

// Employee self-service
leaveRouter.get('/balances', requirePermission('leave.apply'), asyncHandler(async (req, res) => {
  ok(res, await leaveService.balances(req.user!.id));
}));

leaveRouter.get('/mine', requirePermission('leave.apply'), validate(listMyLeaveSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, meta } = await leaveService.listMine(req.user!, req.query as never);
  ok(res, items, 'Success', 200, meta);
}));

leaveRouter.post('/', requirePermission('leave.apply'), validate(applyLeaveSchema), asyncHandler(async (req, res) => {
  const { leave, adminsNotified } = await leaveService.apply(req.user!, req.body);
  await audit(req, { schoolId: leave.schoolId, action: 'CREATE', resource: 'LEAVE', resourceId: leave.id, metadata: { days: leave.days, type: leave.type } });
  ok(res, { ...leave, adminsNotified }, 'Leave request sent to your administrator', 201);
}));

leaveRouter.patch('/:id/cancel', requirePermission('leave.apply'), validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  const leave = await leaveService.cancel(req.user!, req.params.id as string);
  await audit(req, { schoolId: leave.schoolId, action: 'CANCEL', resource: 'LEAVE', resourceId: leave.id });
  ok(res, leave, 'Leave request cancelled');
}));

// Admin review
leaveRouter.get('/', requirePermission('leave.manage'), validate(listLeaveSchema, 'query'), asyncHandler(async (req, res) => {
  const { items, meta } = await leaveService.list(schoolWhere(req, req.query.schoolId as string | undefined), req.query as never);
  ok(res, items, 'Success', 200, meta);
}));

leaveRouter.patch('/:id/review', requirePermission('leave.manage'), validate(idParamSchema, 'params'), validate(reviewLeaveSchema), asyncHandler(async (req, res) => {
  const leave = await leaveService.review(req.user!, schoolWhere(req), req.params.id as string, req.body);
  await audit(req, { schoolId: leave.schoolId, action: { APPROVED: 'APPROVE', REJECTED: 'REJECT', CANCELLED: 'ADMIN_CANCEL' }[req.body.decision as 'APPROVED' | 'REJECTED' | 'CANCELLED'], resource: 'LEAVE', resourceId: leave.id });
  ok(res, leave, `Leave ${leave.status.toLowerCase()}`);
}));
