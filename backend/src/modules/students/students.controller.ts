import type { Request, Response } from 'express';
import { resolveSchoolId } from '../../middlewares/tenant';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { schoolWhere } from '../common/tenant-scope';
import { studentsService } from './students.service';

const requested = (req: Request) => (req.query.schoolId as string | undefined) ?? undefined;

export const studentsController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await studentsService.list(req.user!, schoolWhere(req, requested(req)), req.query as never);
    ok(res, items, 'Success', 200, meta);
  },
  async me(req: Request, res: Response) {
    ok(res, await studentsService.me(req.user!));
  },
  async get(req: Request, res: Response) {
    ok(res, await studentsService.get(req.user!, schoolWhere(req, requested(req)), req.params.id));
  },
  async create(req: Request, res: Response) {
    const schoolId = resolveSchoolId(req, req.body.schoolId);
    const student = await studentsService.create(schoolId, req.body);
    await audit(req, { schoolId, action: 'CREATE', resource: 'STUDENT', resourceId: student.id });
    ok(res, student, 'Student created', 201);
  },
  async update(req: Request, res: Response) {
    const student = await studentsService.update(req.user!, schoolWhere(req), req.params.id, req.body);
    await audit(req, { schoolId: student.schoolId, action: 'UPDATE', resource: 'STUDENT', resourceId: student.id });
    ok(res, student, 'Student updated');
  },
  async remove(req: Request, res: Response) {
    const s = await studentsService.remove(schoolWhere(req), req.params.id);
    await audit(req, { schoolId: s.schoolId, action: 'DELETE', resource: 'STUDENT', resourceId: s.id });
    ok(res, null, 'Student deleted');
  },
};
