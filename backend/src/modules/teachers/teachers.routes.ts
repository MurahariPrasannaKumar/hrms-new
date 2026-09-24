import { Router } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { teachersController as c } from './teachers.controller';
import {
  createTeacherSchema, idParam, listTeachersQuery, setClassesSchema, setSubjectsSchema, updateTeacherSchema,
} from './teachers.validation';

export const teachersRouter = Router();
teachersRouter.use(requireAuth);
teachersRouter.get('/me/classes', requireRole('TEACHER'), asyncHandler(c.myClasses));
teachersRouter.get('/', requirePermission('teachers.read'), validate(listTeachersQuery, 'query'), asyncHandler(c.list));
teachersRouter.post('/', requirePermission('teachers.create'), validate(createTeacherSchema), asyncHandler(c.create));
teachersRouter.get('/:id', requirePermission('teachers.read'), validate(idParam, 'params'), asyncHandler(c.get));
teachersRouter.patch('/:id', requirePermission('teachers.update'), validate(idParam, 'params'), validate(updateTeacherSchema), asyncHandler(c.update));
teachersRouter.delete('/:id', requirePermission('teachers.delete'), validate(idParam, 'params'), asyncHandler(c.remove));
teachersRouter.put('/:id/subjects', requirePermission('teachers.update'), validate(idParam, 'params'), validate(setSubjectsSchema), asyncHandler(c.setSubjects));
teachersRouter.put('/:id/classes', requirePermission('teachers.update'), validate(idParam, 'params'), validate(setClassesSchema), asyncHandler(c.setClasses));
