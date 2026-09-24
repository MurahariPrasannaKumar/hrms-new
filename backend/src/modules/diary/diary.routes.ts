import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/http';
import { assignmentsController as a, diaryController as d } from './diary.controller';
import {
  createAssignmentSchema, createDiarySchema, gradeSchema, idParamSchema, listAssignmentsSchema, listDiarySchema,
  submissionParamSchema, submitSchema, updateAssignmentSchema, updateDiarySchema,
} from './diary.validation';

// Root-mounted: auth is attached per route, never router.use(requireAuth).
export const diaryRouter = Router();
const id = validate(idParamSchema, 'params');

diaryRouter.get('/diary', requireAuth, requirePermission('diary.read'), validate(listDiarySchema, 'query'), asyncHandler(d.list));
diaryRouter.get('/diary/:id', requireAuth, requirePermission('diary.read'), id, asyncHandler(d.get));
diaryRouter.post('/diary/:id/complete', requireAuth, requirePermission('diary.read'), id, asyncHandler(d.complete));
diaryRouter.delete('/diary/:id/complete', requireAuth, requirePermission('diary.read'), id, asyncHandler(d.uncomplete));
diaryRouter.post('/diary', requireAuth, requirePermission('diary.manage'), validate(createDiarySchema), asyncHandler(d.create));
diaryRouter.patch('/diary/:id', requireAuth, requirePermission('diary.manage'), id, validate(updateDiarySchema), asyncHandler(d.update));
diaryRouter.delete('/diary/:id', requireAuth, requirePermission('diary.manage'), id, asyncHandler(d.remove));

diaryRouter.get('/assignments', requireAuth, requirePermission('assignments.read'), validate(listAssignmentsSchema, 'query'), asyncHandler(a.list));
diaryRouter.get('/assignments/:id', requireAuth, requirePermission('assignments.read'), id, asyncHandler(a.get));
diaryRouter.post('/assignments', requireAuth, requirePermission('assignments.manage'), validate(createAssignmentSchema), asyncHandler(a.create));
diaryRouter.patch('/assignments/:id', requireAuth, requirePermission('assignments.manage'), id, validate(updateAssignmentSchema), asyncHandler(a.update));
diaryRouter.delete('/assignments/:id', requireAuth, requirePermission('assignments.manage'), id, asyncHandler(a.remove));
diaryRouter.post('/assignments/:id/submissions', requireAuth, requirePermission('assignments.read'), id, validate(submitSchema), asyncHandler(a.submit));
diaryRouter.get('/assignments/:id/submissions', requireAuth, requirePermission('assignments.read'), id, asyncHandler(a.submissions));
diaryRouter.patch(
  '/assignments/:id/submissions/:submissionId', requireAuth, requirePermission('assignments.manage'),
  validate(submissionParamSchema, 'params'), validate(gradeSchema), asyncHandler(a.grade),
);
