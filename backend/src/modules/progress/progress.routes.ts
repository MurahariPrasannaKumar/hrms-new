import { Router, type Request, type Response } from 'express';
import { requireAuth, requirePermission, requireRole } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler, ok } from '../../utils/http';
import { progressService as s } from './progress.service';
import {
  detailQuerySchema, idParamSchema, studentsQuerySchema, summaryQuerySchema, teachersQuerySchema,
} from './progress.validation';

export const progressRouter = Router();
progressRouter.use(requireAuth);

const staffOnly = [requirePermission('reports.read'), requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER')];
const adminOnly = [requirePermission('reports.read'), requireRole('SUPER_ADMIN', 'SCHOOL_ADMIN')];

progressRouter.get('/summary', ...staffOnly, validate(summaryQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  ok(res, await s.summary(req, req.query as never));
}));
progressRouter.get('/students', ...staffOnly, validate(studentsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await s.students(req, req.query as never);
  ok(res, items, 'Success', 200, meta);
}));
progressRouter.get('/students/:id', ...staffOnly, validate(idParamSchema, 'params'), validate(detailQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  ok(res, await s.studentDetail(req, req.params.id as string, req.query as never));
}));
progressRouter.get('/teachers', ...adminOnly, validate(teachersQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await s.teachers(req, req.query as never);
  ok(res, items, 'Success', 200, meta);
}));
progressRouter.get('/teachers/:id', ...adminOnly, validate(idParamSchema, 'params'), validate(detailQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  ok(res, await s.teacherDetail(req, req.params.id as string, req.query as never));
}));
