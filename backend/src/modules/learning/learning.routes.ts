import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { learningController as c } from './learning.controller';
import {
  categoriesQuerySchema, createCourseSchema, createPathSchema, createResourceSchema, idParamSchema,
  listCoursesSchema, listResourcesSchema, updateCourseSchema, updateResourceSchema,
} from './learning.validation';

// Root-mounted: every route attaches requireAuth itself.
export const learningRouter = Router();
const read = [requireAuth, requirePermission('learning.read')];
const manage = [requireAuth, requirePermission('learning.manage')];
const params = validate(idParamSchema, 'params');

learningRouter.get('/courses', ...read, validate(listCoursesSchema, 'query'), asyncHandler(c.listCourses));
learningRouter.post('/courses', ...manage, validate(createCourseSchema), asyncHandler(c.createCourse));
learningRouter.get('/courses/:id', ...read, params, asyncHandler(c.getCourse));
learningRouter.patch('/courses/:id', ...manage, params, validate(updateCourseSchema), asyncHandler(c.updateCourse));
learningRouter.delete('/courses/:id', ...manage, params, asyncHandler(c.deleteCourse));

learningRouter.post('/lessons/:id/complete', ...read, params, asyncHandler(c.completeLesson));
learningRouter.get('/learning/progress', ...read, asyncHandler(c.progress));
learningRouter.get('/learning/certificates', ...read, asyncHandler(c.certificates));
learningRouter.get('/learning/paths', ...read, asyncHandler(c.listPaths));
learningRouter.post('/learning/paths', ...manage, validate(createPathSchema), asyncHandler(c.createPath));
learningRouter.delete('/learning/paths/:id', ...manage, params, asyncHandler(c.deletePath));

learningRouter.get('/resources', ...read, validate(listResourcesSchema, 'query'), asyncHandler(c.listResources));
learningRouter.get('/resources/categories', ...read, validate(categoriesQuerySchema, 'query'), asyncHandler(c.categories));
learningRouter.post('/resources', ...manage, validate(createResourceSchema), asyncHandler(c.createResource));
learningRouter.get('/resources/:id', ...read, params, asyncHandler(c.getResource));
learningRouter.patch('/resources/:id', ...manage, params, validate(updateResourceSchema), asyncHandler(c.updateResource));
learningRouter.delete('/resources/:id', ...manage, params, asyncHandler(c.deleteResource));
