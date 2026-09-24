import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { usersController as c } from './users.controller';
import { createUserSchema, idParamSchema, listUsersSchema, setPasswordSchema, updateUserSchema } from './users.validation';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/', requirePermission('users.read'), validate(listUsersSchema, 'query'), asyncHandler(c.list));
usersRouter.post('/', requirePermission('users.create'), validate(createUserSchema), asyncHandler(c.create));
usersRouter.get('/:id', requirePermission('users.read'), validate(idParamSchema, 'params'), asyncHandler(c.get));
usersRouter.patch('/:id', requirePermission('users.update'), validate(idParamSchema, 'params'), validate(updateUserSchema), asyncHandler(c.update));
usersRouter.delete('/:id', requirePermission('users.delete'), validate(idParamSchema, 'params'), asyncHandler(c.remove));
usersRouter.delete('/:id/permanent', requirePermission('users.delete'), validate(idParamSchema, 'params'), asyncHandler(c.destroy));
usersRouter.post('/:id/reset-password', requirePermission('users.update'), validate(idParamSchema, 'params'), validate(setPasswordSchema), asyncHandler(c.resetPassword));
