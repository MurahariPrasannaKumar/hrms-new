import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { noticesController as c } from './notices.controller';
import { createNoticeSchema, idParamSchema, listNoticesSchema, updateNoticeSchema } from './notices.validation';

export const noticesRouter = Router();
noticesRouter.use(requireAuth);
noticesRouter.get('/', requirePermission('notices.read'), validate(listNoticesSchema, 'query'), asyncHandler(c.list));
noticesRouter.get('/:id', requirePermission('notices.read'), validate(idParamSchema, 'params'), asyncHandler(c.get));
noticesRouter.post('/', requirePermission('notices.create'), validate(createNoticeSchema), asyncHandler(c.create));
noticesRouter.patch('/:id', requirePermission('notices.update'), validate(idParamSchema, 'params'), validate(updateNoticeSchema), asyncHandler(c.update));
noticesRouter.delete('/:id', requirePermission('notices.delete'), validate(idParamSchema, 'params'), asyncHandler(c.remove));
