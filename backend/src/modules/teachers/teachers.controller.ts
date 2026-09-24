import type { Request, Response } from 'express';
import { resolveSchoolId } from '../../middlewares/tenant';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { schoolWhere } from '../common/tenant-scope';
import { teachersService } from './teachers.service';

const requested = (req: Request) => (req.query.schoolId as string | undefined) ?? undefined;

export const teachersController = {
  async myClasses(req: Request, res: Response) {
    ok(res, await teachersService.myClasses(req.user!.id));
  },
  async list(req: Request, res: Response) {
    const { items, meta } = await teachersService.list(schoolWhere(req, requested(req)), req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async get(req: Request, res: Response) {
    ok(res, await teachersService.get(schoolWhere(req, requested(req)), req.params.id));
  },
  async create(req: Request, res: Response) {
    const schoolId = resolveSchoolId(req, req.body.schoolId);
    const teacher = await teachersService.create(schoolId, req.body);
    await audit(req, { schoolId, action: 'CREATE', resource: 'TEACHER', resourceId: teacher.id });
    ok(res, teacher, 'Teacher created', 201);
  },
  async update(req: Request, res: Response) {
    const teacher = await teachersService.update(schoolWhere(req), req.params.id, req.body);
    await audit(req, { schoolId: teacher.schoolId, action: 'UPDATE', resource: 'TEACHER', resourceId: teacher.id });
    ok(res, teacher, 'Teacher updated');
  },
  async remove(req: Request, res: Response) {
    const t = await teachersService.remove(schoolWhere(req), req.params.id);
    await audit(req, { schoolId: t.schoolId, action: 'DEACTIVATE', resource: 'TEACHER', resourceId: t.id });
    ok(res, null, 'Teacher deactivated');
  },
  async setSubjects(req: Request, res: Response) {
    const r = await teachersService.setSubjects(schoolWhere(req), req.params.id, req.body.subjectIds);
    await audit(req, { schoolId: r.teacher.schoolId, action: 'ASSIGN_SUBJECTS', resource: 'TEACHER', resourceId: r.teacher.id, metadata: { subjectIds: r.subjectIds } });
    ok(res, { subjectIds: r.subjectIds }, 'Subjects updated');
  },
  async setClasses(req: Request, res: Response) {
    const r = await teachersService.setClasses(schoolWhere(req), req.params.id, req.body.assignments);
    await audit(req, { schoolId: r.teacher.schoolId, action: 'ASSIGN_CLASSES', resource: 'TEACHER', resourceId: r.teacher.id, metadata: { assignments: r.assignments } });
    ok(res, { assignments: r.assignments }, 'Classes updated');
  },
};
