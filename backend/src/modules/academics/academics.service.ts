import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import type { AuthUser } from '../../types/express';
import { classNotifier } from './class-notifier';
import { orderBy, pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';

type Tenant = { schoolId?: string };
type Q = PaginationQuery;

const list = async <T>(q: Q, run: (skip: number, take: number) => Promise<[T[], number]>) => {
  const { skip, take } = pageArgs(q);
  const [items, total] = await run(skip, take);
  return { items, meta: pageMeta(q, total) };
};
const contains = (search?: string) => (search ? { contains: search, mode: 'insensitive' as const } : undefined);

const must = async <T>(p: Promise<T | null>, what: string): Promise<T> => {
  const v = await p;
  if (!v) throw ApiError.notFound(`${what} not found`);
  return v;
};
const requireIn = async (p: Promise<unknown>, what: string) => {
  if (!(await p)) throw ApiError.badRequest(`${what} not found in this school`);
};

export const academicsService = {
  // ── Academic years ──
  listYears: (t: Tenant, q: Q) => {
    const where: Prisma.AcademicYearWhereInput = { ...t, name: contains(q.search) };
    return list(q, (skip, take) => prisma.$transaction([
      prisma.academicYear.findMany({ where, skip, take, orderBy: orderBy(q, ['name', 'startDate', 'endDate'], 'startDate') }),
      prisma.academicYear.count({ where }),
    ]));
  },
  createYear: (schoolId: string, d: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean }) =>
    prisma.$transaction(async (tx) => {
      if (d.isCurrent) await tx.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } });
      return tx.academicYear.create({ data: { ...d, schoolId } });
    }),
  async updateYear(t: Tenant, id: string, d: Prisma.AcademicYearUpdateInput) {
    const y = await must(prisma.academicYear.findFirst({ where: { id, ...t } }), 'Academic year');
    return prisma.$transaction(async (tx) => {
      if (d.isCurrent) await tx.academicYear.updateMany({ where: { schoolId: y.schoolId, id: { not: id } }, data: { isCurrent: false } });
      return tx.academicYear.update({ where: { id }, data: d });
    });
  },
  async deleteYear(t: Tenant, id: string) {
    const y = await must(prisma.academicYear.findFirst({ where: { id, ...t } }), 'Academic year');
    await prisma.academicYear.delete({ where: { id } });
    return y;
  },

  // ── Classes ──
  listClasses: (t: Tenant, q: Q & { academicYearId?: string }) => {
    const where: Prisma.ClassWhereInput = { ...t, academicYearId: q.academicYearId, name: contains(q.search) };
    return list(q, (skip, take) => prisma.$transaction([
      prisma.class.findMany({
        where, skip, take, orderBy: orderBy(q, ['name', 'level'], 'level'),
        include: {
          academicYear: { select: { id: true, name: true } },
          sections: { select: { id: true, name: true, _count: { select: { students: true } } }, orderBy: { name: 'asc' } },
          _count: { select: { students: true } },
        },
      }),
      prisma.class.count({ where }),
    ]));
  },
  async createClass(schoolId: string, d: { academicYearId: string; name: string; level?: number }) {
    await requireIn(prisma.academicYear.findFirst({ where: { id: d.academicYearId, schoolId } }), 'Academic year');
    const created = await prisma.class.create({ data: { ...d, schoolId } });
    classNotifier.classCreated(created.id);
    return created;
  },
  async updateClass(t: Tenant, id: string, d: { name?: string; level?: number }) {
    await must(prisma.class.findFirst({ where: { id, ...t } }), 'Class');
    return prisma.class.update({ where: { id }, data: d });
  },
  async deleteClass(t: Tenant, id: string) {
    const c = await must(prisma.class.findFirst({ where: { id, ...t } }), 'Class');
    await prisma.class.delete({ where: { id } });
    return c;
  },

  // ── Sections ──
  listSections: (t: Tenant, q: Q & { classId?: string }) => {
    const where: Prisma.SectionWhereInput = { ...t, classId: q.classId, name: contains(q.search) };
    return list(q, (skip, take) => prisma.$transaction([
      prisma.section.findMany({
        where, skip, take, orderBy: orderBy(q, ['name'], 'name'),
        include: { class: { select: { id: true, name: true } }, _count: { select: { students: true } } },
      }),
      prisma.section.count({ where }),
    ]));
  },
  async createSection(t: Tenant, d: { classId: string; name: string }) {
    const cls = await prisma.class.findFirst({ where: { id: d.classId, ...t } });
    if (!cls) throw ApiError.badRequest('Class not found in this school');
    return prisma.section.create({ data: { classId: cls.id, name: d.name, schoolId: cls.schoolId } });
  },
  async updateSection(t: Tenant, id: string, d: { name?: string }) {
    await must(prisma.section.findFirst({ where: { id, ...t } }), 'Section');
    return prisma.section.update({ where: { id }, data: d });
  },
  async deleteSection(t: Tenant, id: string) {
    const s = await must(prisma.section.findFirst({ where: { id, ...t } }), 'Section');
    await prisma.section.delete({ where: { id } });
    return s;
  },

  // ── Subjects ──
  listSubjects: (t: Tenant, q: Q) => {
    const where: Prisma.SubjectWhereInput = { ...t, ...(q.search ? { OR: [{ name: contains(q.search) }, { code: contains(q.search) }] } : {}) };
    return list(q, (skip, take) => prisma.$transaction([
      prisma.subject.findMany({ where, skip, take, orderBy: orderBy(q, ['name', 'code'], 'name') }),
      prisma.subject.count({ where }),
    ]));
  },
  createSubject: (schoolId: string, d: { name: string; code: string }) => prisma.subject.create({ data: { ...d, schoolId } }),
  async updateSubject(t: Tenant, id: string, d: { name?: string; code?: string }) {
    await must(prisma.subject.findFirst({ where: { id, ...t } }), 'Subject');
    return prisma.subject.update({ where: { id }, data: d });
  },
  async deleteSubject(t: Tenant, id: string) {
    const s = await must(prisma.subject.findFirst({ where: { id, ...t } }), 'Subject');
    await prisma.subject.delete({ where: { id } });
    return s;
  },

  // ── Exams & results ──
  listExams: (t: Tenant, q: Q & { classId?: string; subjectId?: string; academicYearId?: string }) => {
    const where: Prisma.ExamWhereInput = { ...t, classId: q.classId, subjectId: q.subjectId, academicYearId: q.academicYearId, name: contains(q.search) };
    return list(q, (skip, take) => prisma.$transaction([
      prisma.exam.findMany({
        where, skip, take, orderBy: orderBy(q, ['name', 'date'], 'date'),
        include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, _count: { select: { results: true } } },
      }),
      prisma.exam.count({ where }),
    ]));
  },
  async createExam(schoolId: string, { schoolId: _s, ...d }: { schoolId?: string; academicYearId: string; classId: string; subjectId: string; name: string; date: Date; maxMarks?: number }) {
    await Promise.all([
      requireIn(prisma.academicYear.findFirst({ where: { id: d.academicYearId, schoolId } }), 'Academic year'),
      requireIn(prisma.class.findFirst({ where: { id: d.classId, schoolId } }), 'Class'),
      requireIn(prisma.subject.findFirst({ where: { id: d.subjectId, schoolId } }), 'Subject'),
    ]);
    return prisma.exam.create({ data: { ...d, schoolId } });
  },
  async updateExam(t: Tenant, id: string, d: { name?: string; date?: Date; maxMarks?: number }) {
    await must(prisma.exam.findFirst({ where: { id, ...t } }), 'Exam');
    return prisma.exam.update({ where: { id }, data: d });
  },
  async deleteExam(t: Tenant, id: string) {
    const e = await must(prisma.exam.findFirst({ where: { id, ...t } }), 'Exam');
    await prisma.exam.delete({ where: { id } });
    return e;
  },
  async getResults(t: Tenant, id: string) {
    const exam = await must(prisma.exam.findFirst({ where: { id, ...t } }), 'Exam');
    const results = await prisma.examResult.findMany({
      where: { examId: id },
      select: { id: true, studentId: true, marks: true, grade: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { student: { firstName: 'asc' } },
    });
    return { exam, results };
  },
  async putResults(t: Tenant, id: string, results: { studentId: string; marks: number; grade?: string }[]) {
    const exam = await must(prisma.exam.findFirst({ where: { id, ...t } }), 'Exam');
    const ids = [...new Set(results.map((r) => r.studentId))];
    const valid = await prisma.student.count({ where: { id: { in: ids }, schoolId: exam.schoolId, classId: exam.classId } });
    if (valid !== ids.length) throw ApiError.badRequest('One or more students do not belong to this exam\'s class');
    if (results.some((r) => r.marks > exam.maxMarks)) throw ApiError.badRequest(`Marks cannot exceed ${exam.maxMarks}`);
    await prisma.$transaction(
      results.map((r) =>
        prisma.examResult.upsert({
          where: { examId_studentId: { examId: id, studentId: r.studentId } },
          update: { marks: r.marks, grade: r.grade },
          create: { examId: id, studentId: r.studentId, marks: r.marks, grade: r.grade, schoolId: exam.schoolId },
        }),
      ),
    );
    return exam;
  },

  /** Teacher/admin message to all students of a class: platform notification + email. Teachers only for classes they teach. */
  async notifyClass(actor: AuthUser, t: Tenant, classId: string, d: { sectionId?: string; subject: string; message: string }) {
    const cls = await must(prisma.class.findFirst({ where: { id: classId, ...t } }), 'Class');
    if (d.sectionId && !(await prisma.section.findFirst({ where: { id: d.sectionId, classId } }))) throw ApiError.badRequest('Section does not belong to this class');
    if (actor.role === 'TEACHER') {
      const teaches = await prisma.teacherClass.findFirst({
        where: { classId, teacher: { userId: actor.id }, ...(d.sectionId ? { sectionId: d.sectionId } : {}) },
      });
      if (!teaches) throw ApiError.forbidden('Select this class under "Classes I teach" in your profile before messaging its students');
    }
    const sender = await prisma.user.findUnique({ where: { id: actor.id }, select: { firstName: true, lastName: true } });
    const result = await classNotifier.broadcast(cls.id, d.sectionId, `${sender?.firstName ?? ''} ${sender?.lastName ?? ''}`.trim(), d.subject, d.message);
    return { cls, ...result };
  },
};
