import type { Request, Response } from 'express';
import { resolveSchoolId } from '../../middlewares/tenant';
import { audit } from '../../utils/audit';
import { ok } from '../../utils/http';
import { schoolWhere } from '../common/tenant-scope';
import { academicsService as s } from './academics.service';

const requested = (req: Request) => (req.query.schoolId as string | undefined) ?? undefined;
const tenant = (req: Request) => schoolWhere(req, requested(req));

const listOf = (fn: (t: { schoolId?: string }, q: never) => Promise<{ items: unknown[]; meta: unknown }>) =>
  async (req: Request, res: Response) => {
    const { items, meta } = await fn(tenant(req), req.query as never);
    ok(res, items, 'Success', 200, meta);
  };

const createOf = <R extends { id: string; schoolId?: string }>(
  resource: string, label: string,
  fn: (schoolId: string, body: never, req: Request) => Promise<R>,
) => async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId);
  const created = await fn(schoolId, req.body as never, req);
  await audit(req, { schoolId, action: 'CREATE', resource, resourceId: created.id });
  ok(res, created, `${label} created`, 201);
};

const updateOf = <R extends { id: string; schoolId?: string }>(
  resource: string, label: string,
  fn: (t: { schoolId?: string }, id: string, body: never) => Promise<R>,
) => async (req: Request, res: Response) => {
  const updated = await fn(schoolWhere(req), req.params.id, req.body as never);
  await audit(req, { schoolId: updated.schoolId, action: 'UPDATE', resource, resourceId: updated.id });
  ok(res, updated, `${label} updated`);
};

const deleteOf = <R extends { id: string; schoolId?: string }>(
  resource: string, label: string,
  fn: (t: { schoolId?: string }, id: string) => Promise<R>,
) => async (req: Request, res: Response) => {
  const deleted = await fn(schoolWhere(req), req.params.id);
  await audit(req, { schoolId: deleted.schoolId, action: 'DELETE', resource, resourceId: deleted.id });
  ok(res, null, `${label} deleted`);
};

export const academicsController = {
  listYears: listOf(s.listYears),
  createYear: createOf('ACADEMIC_YEAR', 'Academic year', (sid, b) => s.createYear(sid, b)),
  updateYear: updateOf('ACADEMIC_YEAR', 'Academic year', s.updateYear),
  deleteYear: deleteOf('ACADEMIC_YEAR', 'Academic year', s.deleteYear),

  listClasses: listOf(s.listClasses),
  createClass: createOf('CLASS', 'Class', (sid, b) => s.createClass(sid, b)),
  updateClass: updateOf('CLASS', 'Class', s.updateClass),
  deleteClass: deleteOf('CLASS', 'Class', s.deleteClass),

  listSections: listOf(s.listSections),
  async createSection(req: Request, res: Response) {
    const section = await s.createSection(schoolWhere(req), req.body);
    await audit(req, { schoolId: section.schoolId, action: 'CREATE', resource: 'SECTION', resourceId: section.id });
    ok(res, section, 'Section created', 201);
  },
  updateSection: updateOf('SECTION', 'Section', s.updateSection),
  deleteSection: deleteOf('SECTION', 'Section', s.deleteSection),

  listSubjects: listOf(s.listSubjects),
  createSubject: createOf('SUBJECT', 'Subject', (sid, b) => s.createSubject(sid, b)),
  updateSubject: updateOf('SUBJECT', 'Subject', s.updateSubject),
  deleteSubject: deleteOf('SUBJECT', 'Subject', s.deleteSubject),

  listExams: listOf(s.listExams),
  createExam: createOf('EXAM', 'Exam', (sid, b) => s.createExam(sid, b)),
  updateExam: updateOf('EXAM', 'Exam', s.updateExam),
  deleteExam: deleteOf('EXAM', 'Exam', s.deleteExam),

  async notifyClass(req: Request, res: Response) {
    const r = await s.notifyClass(req.user!, schoolWhere(req), req.params.id, req.body);
    await audit(req, { schoolId: r.cls.schoolId, action: 'NOTIFY', resource: 'CLASS', resourceId: r.cls.id, metadata: { students: r.students } });
    ok(res, { students: r.students, inApp: r.inApp, emailOnly: r.emailOnly }, `Sent to ${r.students} student${r.students === 1 ? '' : 's'}`);
  },
  async getResults(req: Request, res: Response) {
    ok(res, await s.getResults(tenant(req), req.params.id));
  },
  async putResults(req: Request, res: Response) {
    const exam = await s.putResults(schoolWhere(req), req.params.id, req.body.results);
    await audit(req, { schoolId: exam.schoolId, action: 'ENTER_RESULTS', resource: 'EXAM', resourceId: exam.id, metadata: { count: req.body.results.length } });
    ok(res, null, 'Results saved');
  },
};
