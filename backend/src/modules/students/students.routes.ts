import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { studentsController as c } from './students.controller';
import { createStudentSchema, idParam, listStudentsQuery, updateStudentSchema } from './students.validation';

export const studentsRouter = Router();
studentsRouter.use(requireAuth);
studentsRouter.get('/', requirePermission('students.read'), validate(listStudentsQuery, 'query'), asyncHandler(c.list));
studentsRouter.post('/', requirePermission('students.create'), validate(createStudentSchema), asyncHandler(c.create));
studentsRouter.get('/me', asyncHandler(c.me));
studentsRouter.get('/:id', requirePermission('students.read'), validate(idParam, 'params'), asyncHandler(c.get));
studentsRouter.patch('/:id', requirePermission('students.update'), validate(idParam, 'params'), validate(updateStudentSchema), asyncHandler(c.update));
studentsRouter.delete('/:id', requirePermission('students.delete'), validate(idParam, 'params'), asyncHandler(c.remove));
