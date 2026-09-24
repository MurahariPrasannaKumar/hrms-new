import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { notificationsController as c } from './notifications.controller';
import { idParamSchema, listNotificationsSchema } from './notifications.validation';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', validate(listNotificationsSchema, 'query'), asyncHandler(c.list));
notificationsRouter.patch('/read-all', asyncHandler(c.markAllRead));
notificationsRouter.patch('/:id/read', validate(idParamSchema, 'params'), asyncHandler(c.markRead));
