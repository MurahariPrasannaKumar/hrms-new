import { Router } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { schoolsController as c } from './schools.controller';
import { createSchoolSchema, idParamSchema, listSchoolsSchema, updateSchoolSchema } from './schools.validation';

export const schoolsRouter = Router();
schoolsRouter.use(requireAuth);

schoolsRouter.get('/', requirePermission('schools.read'), validate(listSchoolsSchema, 'query'), asyncHandler(c.list));
schoolsRouter.post('/', requirePermission('schools.create'), validate(createSchoolSchema), asyncHandler(c.create));
// Own-school access for SCHOOL_ADMIN is enforced in the service.
schoolsRouter.get('/:id', requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'), validate(idParamSchema, 'params'), asyncHandler(c.get));
schoolsRouter.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN'),
  requirePermission('settings.manage'),
  validate(idParamSchema, 'params'),
  validate(updateSchoolSchema),
  asyncHandler(c.update),
);
schoolsRouter.delete('/:id', requirePermission('schools.delete'), validate(idParamSchema, 'params'), asyncHandler(c.remove));
