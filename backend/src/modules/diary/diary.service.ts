import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { optionalSchoolScope, resolveSchoolId } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import { getMemberScope, getOwnStudentIds, getTeacherContext } from '../../utils/actor';
import { audit } from '../../utils/audit';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { deliverToStudents } from '../academics/class-notifier';
import { notificationService } from '../notifications/notification.service';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { diaryRepository as repo } from './diary.repository';

/** Resolves the teacher a new diary entry/assignment belongs to and checks class access. */
const resolveAuthor = async (req: Request, schoolId: string, classId: string, sectionId: string | undefined, teacherId?: string) => {
  const cls = await repo.findClass(classId, schoolId);
  if (!cls) throw ApiError.notFound('Class not found');
  if (sectionId && !(await repo.findSection(sectionId, classId, schoolId))) throw ApiError.notFound('Section not found');

  if (req.user!.role === 'TEACHER') {
    const ctx = await getTeacherContext(req.user!.id);
    if (!ctx || !ctx.classIds.includes(classId)) throw ApiError.forbidden('You are not assigned to this class');
    if (sectionId && !ctx.sectionIds.includes(sectionId)) throw ApiError.forbidden('You are not assigned to this section');
    return ctx.teacherId;
  }
  if (!teacherId) throw ApiError.badRequest('teacherId is required');
  if (!(await repo.findTeacher(teacherId, schoolId))) throw ApiError.notFound('Teacher not found');
  return teacherId;
};

const assertFile = async (fileId: string | null | undefined, schoolId: string) => {
  if (fileId && !(await repo.findFile(fileId, schoolId))) throw ApiError.notFound('Attachment not found');
};

const ownTeacherFilter = async (req: Request) =>
  req.user!.role === 'TEACHER' ? { teacherId: (await getTeacherContext(req.user!.id))?.teacherId ?? '__none__' } : {};

const tenant = (req: Request): Prisma.DiaryEntryWhereInput =>
  req.user!.role === 'SUPER_ADMIN' ? {} : { schoolId: req.user!.schoolId! };

export const diaryService = {
  async list(req: Request, q: PaginationQuery & { schoolId?: string; classId?: string; sectionId?: string; subjectId?: string; isHomework?: string; from?: Date; to?: Date }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const and: Prisma.DiaryEntryWhereInput[] = [schoolId ? { schoolId } : {}];
    if (q.classId) and.push({ classId: q.classId });
    if (q.sectionId) and.push({ sectionId: q.sectionId });
    if (q.subjectId) and.push({ subjectId: q.subjectId });
    if (q.isHomework) and.push({ isHomework: q.isHomework === 'true' });
    if (q.from || q.to) and.push({ createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } });
    if (q.search) and.push({ OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }] });

    const own = await getOwnStudentIds(req.user!);
    if (own) {
      const scope = await getMemberScope(req.user!);
      and.push({ classId: { in: scope?.classIds ?? [] }, OR: [{ sectionId: null }, { sectionId: { in: scope?.sectionIds ?? [] } }] });
    } else if (req.user!.role === 'TEACHER') {
      and.push(await ownTeacherFilter(req));
    }
    const { skip, take } = pageArgs(q);
    const [items, total] = await repo.listDiary({ AND: and }, skip, take);
    const done = await prisma.diaryCompletion.findMany({
      where: { userId: req.user!.id, diaryEntryId: { in: items.map((i) => i.id) } },
      select: { diaryEntryId: true },
    });
    const doneIds = new Set(done.map((d) => d.diaryEntryId));
    return { items: items.map((i) => ({ ...i, completed: doneIds.has(i.id) })), meta: pageMeta(q, total) };
  },

  async setCompleted(req: Request, id: string, completed: boolean) {
    await this.get(req, id); // visibility + tenant check
    const key = { diaryEntryId_userId: { diaryEntryId: id, userId: req.user!.id } };
    if (completed) await prisma.diaryCompletion.upsert({ where: key, update: {}, create: { diaryEntryId: id, userId: req.user!.id } });
    else await prisma.diaryCompletion.deleteMany({ where: { diaryEntryId: id, userId: req.user!.id } });
    return { id, completed };
  },

  async get(req: Request, id: string) {
    const entry = await repo.findDiary(id, tenant(req));
    if (!entry) throw ApiError.notFound('Diary entry not found');
    const own = await getOwnStudentIds(req.user!);
    if (own) {
      const scope = await getMemberScope(req.user!);
      const visible = scope?.classIds.includes(entry.classId) && (!entry.sectionId || scope.sectionIds.includes(entry.sectionId));
      if (!visible) throw ApiError.notFound('Diary entry not found');
    } else if (req.user!.role === 'TEACHER' && (await ownTeacherFilter(req)).teacherId !== entry.teacherId) {
      throw ApiError.notFound('Diary entry not found');
    }
    return entry;
  },

  async create(req: Request, body: { schoolId?: string; teacherId?: string; classId: string; sectionId?: string; subjectId?: string; title: string; body: string; isHomework: boolean; dueDate?: Date; fileId?: string }) {
    const schoolId = resolveSchoolId(req, body.schoolId);
    await assertFile(body.fileId, schoolId);
    const teacherId = await resolveAuthor(req, schoolId, body.classId, body.sectionId, body.teacherId);
    if (body.subjectId && !(await repo.findSubject(body.subjectId, schoolId))) throw ApiError.notFound('Subject not found');
    const entry = await repo.createDiary({
      schoolId, teacherId, classId: body.classId, sectionId: body.sectionId, subjectId: body.subjectId,
      title: body.title, body: body.body, isHomework: body.isHomework, dueDate: body.dueDate, fileId: body.fileId,
    });
    await audit(req, { schoolId, action: 'CREATE', resource: 'DIARY_ENTRY', resourceId: entry.id });
    return entry;
  },

  async update(req: Request, id: string, body: { title?: string; body?: string; subjectId?: string; isHomework?: boolean; dueDate?: Date | null; fileId?: string | null }) {
    const existing = await repo.findDiary(id, { ...tenant(req), ...(await ownTeacherFilter(req)) });
    if (!existing) throw ApiError.notFound('Diary entry not found');
    if (body.subjectId && !(await repo.findSubject(body.subjectId, existing.schoolId))) throw ApiError.notFound('Subject not found');
    await assertFile(body.fileId, existing.schoolId);
    const entry = await repo.updateDiary(id, body);
    await audit(req, { schoolId: existing.schoolId, action: 'UPDATE', resource: 'DIARY_ENTRY', resourceId: id });
    return entry;
  },

  async remove(req: Request, id: string) {
    const existing = await repo.findDiary(id, { ...tenant(req), ...(await ownTeacherFilter(req)) });
    if (!existing) throw ApiError.notFound('Diary entry not found');
    await repo.deleteDiary(id);
    await audit(req, { schoolId: existing.schoolId, action: 'DELETE', resource: 'DIARY_ENTRY', resourceId: id });
  },
};

// ───────────── Assignments ─────────────

const asnTenant = (req: Request): Prisma.AssignmentWhereInput =>
  req.user!.role === 'SUPER_ADMIN' ? {} : { schoolId: req.user!.schoolId! };

const assertAssignmentVisible = async (req: Request, classId: string, teacherId: string) => {
  const own = await getOwnStudentIds(req.user!);
  if (own) {
    const scope = await getMemberScope(req.user!);
    if (!scope?.classIds.includes(classId)) throw ApiError.notFound('Assignment not found');
  } else if (req.user!.role === 'TEACHER' && (await ownTeacherFilter(req)).teacherId !== teacherId) {
    throw ApiError.notFound('Assignment not found');
  }
};

/** Tells the assignment's teacher (platform notification + email) that a student handed in work. Never blocks the student. */
const notifyTeacherOfSubmission = async (
  a: { id: string; title: string; dueDate: Date | null; teacherId: string; class: { name: string }; subject: { name: string } },
  studentId: string,
  resubmitted: boolean,
  hasFile: boolean,
) => {
  try {
    const [teacher, student] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: a.teacherId }, select: { userId: true } }),
      prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true, admissionNumber: true } }),
    ]);
    if (!teacher || !student) return;
    const who = `${student.firstName} ${student.lastName}`;
    const late = !!a.dueDate && new Date() > new Date(a.dueDate.getTime() + 86_400_000);
    await notificationService.notify(
      [teacher.userId],
      {
        type: 'ASSIGNMENT', link: '/assignments',
        title: `${resubmitted ? 'Resubmitted' : 'Submitted'}: ${a.title} (${who})`,
        message: `${who} ${resubmitted ? 'resubmitted' : 'submitted'} "${a.title}" for ${a.class.name}${late ? ' after the due date' : ''}. Open Assignments to review it and enter marks.`,
        email: {
          category: 'Assignments',
          details: [
            { label: 'Student', value: `${who} (${student.admissionNumber})` },
            { label: 'Assignment', value: a.title },
            { label: 'Class', value: a.class.name },
            { label: 'Subject', value: a.subject.name },
            { label: 'Due date', value: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : 'No due date' },
            { label: 'Status', value: `${resubmitted ? 'Resubmitted' : 'Submitted'}${late ? ' (late)' : ''}${hasFile ? ', with an attachment' : ''}` },
          ],
          action: { label: 'Review submission', path: '{area}/assignments' },
        },
      },
      ['IN_APP', 'EMAIL'],
    );
  } catch (err) {
    logger.error({ err, assignmentId: a.id }, 'Submission notification failed');
  }
};

/** Tells the student (and their parent, in the platform) that an assignment was marked. */
const notifyStudentOfMarks = async (
  a: { id: string; title: string; class: { name: string }; subject: { name: string }; teacher: { user: { firstName: string; lastName: string } } },
  studentId: string,
  marks: number,
) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, userId: true, parent: { select: { userId: true } } } });
    if (!student) return;
    const by = `${a.teacher.user.firstName} ${a.teacher.user.lastName}`;
    const title = `Marks received: ${a.title}`;
    if (student.userId) {
      await notificationService.notify(
        [student.userId],
        {
          type: 'ASSIGNMENT', link: '/assignments', title,
          message: `${by} marked your ${a.subject.name} assignment "${a.title}". You scored ${marks}.`,
          email: {
            category: 'Assignments',
            details: [
              { label: 'Assignment', value: a.title },
              { label: 'Subject', value: a.subject.name },
              { label: 'Class', value: a.class.name },
              { label: 'Your marks', value: String(marks) },
              { label: 'Marked by', value: by },
            ],
            action: { label: 'View my assignments', path: '{area}/assignments' },
          },
        },
        ['IN_APP', 'EMAIL'],
      );
    }
    if (student.parent?.userId) {
      await notificationService.notify([student.parent.userId], { type: 'ASSIGNMENT', title, message: `${student.firstName} scored ${marks} on "${a.title}" (${a.subject.name}).` });
    }
  } catch (err) {
    logger.error({ err, assignmentId: a.id }, 'Marks notification failed');
  }
};

export const assignmentsService = {
  async list(req: Request, q: PaginationQuery & { schoolId?: string; classId?: string; subjectId?: string }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const and: Prisma.AssignmentWhereInput[] = [schoolId ? { schoolId } : {}];
    if (q.classId) and.push({ classId: q.classId });
    if (q.subjectId) and.push({ subjectId: q.subjectId });
    if (q.search) and.push({ title: { contains: q.search, mode: 'insensitive' } });
    if (await getOwnStudentIds(req.user!)) and.push({ classId: { in: (await getMemberScope(req.user!))?.classIds ?? [] } });
    else if (req.user!.role === 'TEACHER') and.push(await ownTeacherFilter(req));
    const { skip, take } = pageArgs(q);
    const [items, total] = await repo.listAssignments({ AND: and }, skip, take);
    const own = await getOwnStudentIds(req.user!);
    if (req.user!.role === 'STUDENT' && own?.length) {
      const mine = await prisma.assignmentSubmission.findMany({
        where: { studentId: own[0], assignmentId: { in: items.map((i) => i.id) } },
        select: { assignmentId: true, submittedAt: true, marks: true, content: true, fileId: true },
      });
      const byId = new Map(mine.map((m) => [m.assignmentId, m]));
      return { items: items.map((i) => ({ ...i, mySubmission: byId.get(i.id) ?? null })), meta: pageMeta(q, total) };
    }
    return { items, meta: pageMeta(q, total) };
  },

  async get(req: Request, id: string) {
    const a = await repo.findAssignment(id, asnTenant(req));
    if (!a) throw ApiError.notFound('Assignment not found');
    await assertAssignmentVisible(req, a.classId, a.teacherId);
    return a;
  },

  async create(req: Request, body: { schoolId?: string; teacherId?: string; classId: string; subjectId: string; title: string; description?: string; dueDate?: Date; fileId?: string; notify?: boolean }) {
    const schoolId = resolveSchoolId(req, body.schoolId);
    await assertFile(body.fileId, schoolId);
    const teacherId = await resolveAuthor(req, schoolId, body.classId, undefined, body.teacherId);
    if (!(await repo.findSubject(body.subjectId, schoolId))) throw ApiError.notFound('Subject not found');
    const a = await repo.createAssignment({ schoolId, teacherId, classId: body.classId, subjectId: body.subjectId, title: body.title, description: body.description, dueDate: body.dueDate, fileId: body.fileId });
    if (body.notify !== false) {
      const [students, subject, cls, teacherUser] = await Promise.all([
        prisma.student.findMany({
          where: { classId: body.classId, schoolId, status: 'ACTIVE' },
          select: { email: true, firstName: true, userId: true, parent: { select: { userId: true } } },
        }),
        prisma.subject.findUnique({ where: { id: body.subjectId }, select: { name: true } }),
        prisma.class.findUnique({ where: { id: body.classId }, select: { name: true } }),
        prisma.teacher.findUnique({ where: { id: teacherId }, select: { user: { select: { firstName: true, lastName: true } } } }),
      ]);
      const by = teacherUser ? `${teacherUser.user.firstName} ${teacherUser.user.lastName}` : 'Your teacher';
      const due = body.dueDate ? body.dueDate.toISOString().slice(0, 10) : 'No due date';
      const title = `New assignment: ${body.title}`;
      const message = `${by} posted a new ${subject?.name ?? ''} assignment for ${cls?.name ?? 'your class'}.${body.description ? `

${body.description.slice(0, 500)}` : ''}`;
      void deliverToStudents(students, {
        type: 'ASSIGNMENT', title, message,
        email: {
          category: 'Assignments',
          details: [
            { label: 'Assignment', value: body.title },
            { label: 'Subject', value: subject?.name ?? '-' },
            { label: 'Class', value: cls?.name ?? '-' },
            { label: 'Due date', value: due },
            { label: 'Posted by', value: by },
            ...(body.fileId ? [{ label: 'Attachment', value: 'Included, open the assignment to download it' }] : []),
          ],
          action: { label: 'Open assignment', path: '{area}/assignments' },
        },
      }).catch(() => undefined);
      // Parents get the platform notification only (they have no assignments page to link to).
      void notificationService.notify(
        students.map((s) => s.parent?.userId).filter((x): x is string => !!x),
        { type: 'ASSIGNMENT', title, message },
      );
    }
    await audit(req, { schoolId, action: 'CREATE', resource: 'ASSIGNMENT', resourceId: a.id });
    return a;
  },

  async update(req: Request, id: string, body: { title?: string; description?: string | null; dueDate?: Date | null; fileId?: string | null }) {
    const existing = await repo.findAssignment(id, { ...asnTenant(req), ...(await ownTeacherFilter(req)) });
    if (!existing) throw ApiError.notFound('Assignment not found');
    await assertFile(body.fileId, existing.schoolId);
    const a = await repo.updateAssignment(id, body);
    await audit(req, { schoolId: existing.schoolId, action: 'UPDATE', resource: 'ASSIGNMENT', resourceId: id });
    return a;
  },

  async remove(req: Request, id: string) {
    const existing = await repo.findAssignment(id, { ...asnTenant(req), ...(await ownTeacherFilter(req)) });
    if (!existing) throw ApiError.notFound('Assignment not found');
    await repo.deleteAssignment(id);
    await audit(req, { schoolId: existing.schoolId, action: 'DELETE', resource: 'ASSIGNMENT', resourceId: id });
  },

  async submit(req: Request, id: string, body: { content?: string; fileId?: string }) {
    if (req.user!.role !== 'STUDENT') throw ApiError.forbidden('Only students can submit assignments');
    const a = await repo.findAssignment(id, asnTenant(req));
    if (!a) throw ApiError.notFound('Assignment not found');
    const [studentId] = (await getOwnStudentIds(req.user!)) ?? [];
    const scope = await getMemberScope(req.user!);
    if (!studentId || !scope?.classIds.includes(a.classId)) throw ApiError.forbidden('This assignment is not for your class');
    if (!body.content?.trim() && !body.fileId) throw ApiError.badRequest('Write an answer or attach a file');
    await assertFile(body.fileId, a.schoolId);
    const existing = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId: id, studentId } }, select: { id: true } });
    const submission = await repo.upsertSubmission(id, studentId, a.schoolId, body);
    await audit(req, { schoolId: a.schoolId, action: existing ? 'RESUBMIT' : 'SUBMIT', resource: 'ASSIGNMENT_SUBMISSION', resourceId: submission.id });
    void notifyTeacherOfSubmission(a, studentId, !!existing, !!body.fileId);
    return submission;
  },

  async listSubmissions(req: Request, id: string) {
    const a = await repo.findAssignment(id, asnTenant(req));
    if (!a) throw ApiError.notFound('Assignment not found');
    const own = await getOwnStudentIds(req.user!);
    if (own) return repo.submissions(id, own);
    await assertAssignmentVisible(req, a.classId, a.teacherId);
    return repo.submissions(id);
  },

  async grade(req: Request, id: string, submissionId: string, marks: number) {
    const a = await repo.findAssignment(id, { ...asnTenant(req), ...(await ownTeacherFilter(req)) });
    if (!a) throw ApiError.notFound('Assignment not found');
    if (!(await repo.findSubmission(submissionId, id, a.schoolId))) throw ApiError.notFound('Submission not found');
    const s = await repo.gradeSubmission(submissionId, marks);
    await audit(req, { schoolId: a.schoolId, action: 'GRADE', resource: 'ASSIGNMENT_SUBMISSION', resourceId: submissionId, metadata: { marks } });
    void notifyStudentOfMarks(a, s.studentId, marks);
    return s;
  },
};
