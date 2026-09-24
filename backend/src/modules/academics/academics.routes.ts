import { Router } from 'express';
import type { Request, Response } from 'express';
type H = (req: Request, res: Response) => Promise<unknown>;
import type { ZodSchema } from 'zod';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { academicsController as c } from './academics.controller';
import * as v from './academics.validation';

// Root-mounted: auth is attached per route, never at router level.
export const academicsRouter = Router();

const read = [requireAuth, requirePermission('academics.read')];
const manage = [requireAuth, requirePermission('academics.manage')];
const id = validate(v.idParam, 'params');

const crud = (
  path: string,
  h: { list: H; create: H; update: H; remove: H },
  s: { list: ZodSchema; create: ZodSchema; update: ZodSchema },
) => {
  academicsRouter.get(path, ...read, validate(s.list, 'query'), asyncHandler(h.list));
  academicsRouter.post(path, ...manage, validate(s.create), asyncHandler(h.create));
  academicsRouter.patch(`${path}/:id`, ...manage, id, validate(s.update), asyncHandler(h.update));
  academicsRouter.delete(`${path}/:id`, ...manage, id, asyncHandler(h.remove));
};

crud('/academic-years', { list: c.listYears, create: c.createYear, update: c.updateYear, remove: c.deleteYear },
  { list: v.listYearsQuery, create: v.createYearSchema, update: v.updateYearSchema });
crud('/classes', { list: c.listClasses, create: c.createClass, update: c.updateClass, remove: c.deleteClass },
  { list: v.listClassesQuery, create: v.createClassSchema, update: v.updateClassSchema });
crud('/sections', { list: c.listSections, create: c.createSection, update: c.updateSection, remove: c.deleteSection },
  { list: v.listSectionsQuery, create: v.createSectionSchema, update: v.updateSectionSchema });
crud('/subjects', { list: c.listSubjects, create: c.createSubject, update: c.updateSubject, remove: c.deleteSubject },
  { list: v.listSubjectsQuery, create: v.createSubjectSchema, update: v.updateSubjectSchema });
crud('/exams', { list: c.listExams, create: c.createExam, update: c.updateExam, remove: c.deleteExam },
  { list: v.listExamsQuery, create: v.createExamSchema, update: v.updateExamSchema });

academicsRouter.get('/exams/:id/results', ...read, id, asyncHandler(c.getResults));
academicsRouter.put('/exams/:id/results', ...manage, id, validate(v.putResultsSchema), asyncHandler(c.putResults));
academicsRouter.post('/classes/:id/notify', ...manage, id, validate(v.notifyClassSchema), asyncHandler(c.notifyClass));
