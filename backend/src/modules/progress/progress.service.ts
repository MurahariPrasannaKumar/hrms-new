import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { optionalSchoolScope } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import { getTeacherContext } from '../../utils/actor';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { buildOverview, localDateString, schoolTimezone, type DayRow, type Status } from '../attendance/attendance-stats';
import { teacherOverviewById } from '../attendance/attendance-self.service';
import { RISK_ORDER, studentMetrics, teacherMetrics, type Risk, type StudentMetrics } from './progress.metrics';

const studentSelect = {
  id: true, userId: true, classId: true, firstName: true, lastName: true, admissionNumber: true,
  class: { select: { name: true } }, section: { select: { name: true } },
} satisfies Prisma.StudentSelect;
type StudentRow = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

const METRIC_SORTS = ['attendancePct', 'avgExamPct', 'assignmentsSubmitted', 'lessonsCompleted', 'riskLevel'] as const;
const NAME_SORTS: Record<string, Prisma.StudentOrderByWithRelationInput> = {
  name: { firstName: 'asc' }, admissionNumber: { admissionNumber: 'asc' }, class: { class: { name: 'asc' } },
};

const toRow = (s: StudentRow, m: StudentMetrics) => ({
  studentId: s.id,
  name: `${s.firstName} ${s.lastName}`,
  admissionNumber: s.admissionNumber,
  class: s.class?.name ?? null,
  section: s.section?.name ?? null,
  ...m,
});

/** Tenant + role scoping shared by every student progress query. */
const studentScope = async (req: Request, q: { schoolId?: string; classId?: string; sectionId?: string; search?: string }) => {
  const schoolId = optionalSchoolScope(req, q.schoolId);
  const where: Prisma.StudentWhereInput = {
    status: 'ACTIVE',
    ...(schoolId ? { schoolId } : {}),
    ...(q.classId ? { classId: q.classId } : {}),
    ...(q.search
      ? { OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { admissionNumber: { contains: q.search, mode: 'insensitive' } },
        ] }
      : {}),
  };
  if (req.user!.role === 'TEACHER') {
    const allowed = (await getTeacherContext(req.user!.id))?.sectionIds ?? [];
    where.sectionId = q.sectionId ? (allowed.includes(q.sectionId) ? q.sectionId : { in: [] }) : { in: allowed };
  } else if (q.sectionId) where.sectionId = q.sectionId;
  return { schoolId, where };
};

export const progressService = {
  async students(req: Request, q: PaginationQuery & { schoolId?: string; classId?: string; sectionId?: string; risk?: Risk }) {
    const { where } = await studentScope(req, q);
    const needsAll = !!q.risk || (!!q.sortBy && (METRIC_SORTS as readonly string[]).includes(q.sortBy));

    if (!needsAll) {
      const orderBy = (q.sortBy && NAME_SORTS[q.sortBy]
        ? Object.fromEntries(Object.entries(NAME_SORTS[q.sortBy]).map(([k, v]) => [k, typeof v === 'string' ? q.sortOrder : v]))
        : { firstName: 'asc' }) as Prisma.StudentOrderByWithRelationInput;
      const { skip, take } = pageArgs(q);
      const [students, total] = await prisma.$transaction([
        prisma.student.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip, take, select: studentSelect }),
        prisma.student.count({ where }),
      ]);
      const metrics = await studentMetrics(students);
      return { items: students.map((s) => toRow(s, metrics.get(s.id)!)), meta: pageMeta(q, total) };
    }

    // Metric-based sort / risk filter: compute for the whole filtered set (grouped queries), then page in memory.
    const students = await prisma.student.findMany({ where, select: studentSelect, orderBy: { firstName: 'asc' } });
    const metrics = await studentMetrics(students);
    let rows = students.map((s) => toRow(s, metrics.get(s.id)!));
    if (q.risk) rows = rows.filter((r) => r.riskLevel === q.risk);
    if (q.sortBy) {
      const dir = q.sortOrder === 'asc' ? 1 : -1;
      const key = q.sortBy as (typeof METRIC_SORTS)[number];
      rows.sort((a, b) => {
        if (key === 'riskLevel') return (RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]) * -dir;
        const av = a[key] ?? -1;
        const bv = b[key] ?? -1;
        return (av - bv) * dir;
      });
    }
    const { skip, take } = pageArgs(q);
    return { items: rows.slice(skip, skip + take), meta: pageMeta(q, rows.length) };
  },

  async summary(req: Request, q: { schoolId?: string; classId?: string; sectionId?: string }) {
    const { where } = await studentScope(req, q);
    const students = await prisma.student.findMany({ where, select: studentSelect });
    const metrics = await studentMetrics(students);
    const rows = students.map((s) => toRow(s, metrics.get(s.id)!));
    const risk = { ok: 0, watch: 0, at_risk: 0 };
    for (const r of rows) risk[r.riskLevel]++;
    const withAtt = rows.filter((r) => r.attendancePct !== null);
    const withExam = rows.filter((r) => r.avgExamPct !== null);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    const byAtt = [...withAtt].sort((a, b) => (a.attendancePct! - b.attendancePct!));
    const pick = (r: (typeof rows)[number]) => ({ studentId: r.studentId, name: r.name, class: r.class, section: r.section, attendancePct: r.attendancePct, riskLevel: r.riskLevel });
    return {
      totalStudents: rows.length,
      risk,
      avgAttendancePct: avg(withAtt.map((r) => r.attendancePct!)),
      avgExamPct: avg(withExam.map((r) => r.avgExamPct!)),
      lowestAttendance: byAtt.slice(0, 5).map(pick),
      highestAttendance: byAtt.slice(-5).reverse().map(pick),
    };
  },

  async studentDetail(req: Request, id: string, q: { schoolId?: string; month?: string }) {
    const { where } = await studentScope(req, { schoolId: q.schoolId });
    const student = await prisma.student.findFirst({
      where: { ...where, id },
      select: { ...studentSelect, schoolId: true, sectionId: true, parent: { select: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    });
    if (!student) throw ApiError.notFound('Student not found');

    const tz = await schoolTimezone(student.schoolId);
    const todayStr = localDateString(tz);
    const [metrics, records, results, assignments, submissions, lessons] = await Promise.all([
      studentMetrics([student]),
      prisma.attendanceRecord.findMany({ where: { studentId: id }, select: { status: true, attendance: { select: { date: true } } } }),
      prisma.examResult.findMany({
        where: { studentId: id },
        select: { marks: true, grade: true, exam: { select: { id: true, name: true, date: true, maxMarks: true, subject: { select: { name: true } } } } },
        orderBy: { exam: { date: 'desc' } },
      }),
      student.classId
        ? prisma.assignment.findMany({ where: { classId: student.classId }, select: { id: true, title: true, dueDate: true, subject: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 })
        : Promise.resolve([]),
      prisma.assignmentSubmission.findMany({ where: { studentId: id }, select: { assignmentId: true, submittedAt: true, marks: true } }),
      student.userId
        ? prisma.learningProgress.findMany({ where: { userId: student.userId, completed: true }, select: { completedAt: true, lesson: { select: { title: true, module: { select: { course: { select: { title: true } } } } } } }, orderBy: { completedAt: 'desc' }, take: 10 })
        : Promise.resolve([]),
    ]);

    const rows: DayRow[] = records.map((r) => ({ date: r.attendance.date, status: r.status as Status }));
    const bySubject = new Map<string, { exams: { name: string; date: Date; marks: number; maxMarks: number; pct: number; grade: string | null }[] }>();
    for (const r of results) {
      const list = bySubject.get(r.exam.subject.name) ?? { exams: [] };
      list.exams.push({ name: r.exam.name, date: r.exam.date, marks: r.marks, maxMarks: r.exam.maxMarks, pct: Math.round((r.marks / r.exam.maxMarks) * 1000) / 10, grade: r.grade });
      bySubject.set(r.exam.subject.name, list);
    }
    const subm = new Map(submissions.map((s) => [s.assignmentId, s]));
    return {
      student: {
        id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber,
        class: student.class?.name ?? null, section: student.section?.name ?? null,
        parent: student.parent ? { name: `${student.parent.user.firstName} ${student.parent.user.lastName}`, email: student.parent.user.email } : null,
      },
      metrics: metrics.get(id)!,
      attendance: buildOverview(rows, q.month ?? todayStr.slice(0, 7), todayStr),
      subjects: [...bySubject.entries()].map(([subject, v]) => ({
        subject, averagePct: Math.round((v.exams.reduce((a, e) => a + e.pct, 0) / v.exams.length) * 10) / 10, exams: v.exams,
      })),
      assignments: assignments.map((a) => ({
        id: a.id, title: a.title, subject: a.subject.name, dueDate: a.dueDate,
        submitted: subm.has(a.id), submittedAt: subm.get(a.id)?.submittedAt ?? null, marks: subm.get(a.id)?.marks ?? null,
      })),
      learning: {
        lessonsCompleted: metrics.get(id)!.lessonsCompleted,
        recent: lessons.map((l) => ({ lesson: l.lesson.title, course: l.lesson.module.course.title, completedAt: l.completedAt })),
      },
    };
  },

  async teachers(req: Request, q: PaginationQuery & { schoolId?: string }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const where: Prisma.TeacherWhereInput = {
      ...(schoolId ? { schoolId } : {}),
      user: { status: 'ACTIVE' },
      ...(q.search
        ? { OR: [
            { employeeId: { contains: q.search, mode: 'insensitive' } },
            { user: { firstName: { contains: q.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: q.search, mode: 'insensitive' } } },
          ] }
        : {}),
    };
    const orderBy: Prisma.TeacherOrderByWithRelationInput =
      q.sortBy === 'employeeId' ? { employeeId: q.sortOrder } : q.sortBy === 'name' ? { user: { firstName: q.sortOrder } } : { user: { firstName: 'asc' } };
    const { skip, take } = pageArgs(q);
    const [teachers, total] = await prisma.$transaction([
      prisma.teacher.findMany({ where, orderBy: [orderBy, { id: 'asc' }], skip, take, select: teacherSelect }),
      prisma.teacher.count({ where }),
    ]);
    const metrics = await teacherMetrics(teachers);
    return { items: teachers.map((t) => teacherRow(t, metrics.get(t.id)!)), meta: pageMeta(q, total) };
  },

  async teacherDetail(req: Request, id: string, q: { schoolId?: string; month?: string }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const teacher = await prisma.teacher.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, select: teacherSelect });
    if (!teacher) throw ApiError.notFound('Teacher not found');
    const [metrics, attendance, assignments, diary] = await Promise.all([
      teacherMetrics([teacher]),
      teacherOverviewById(teacher.id, teacher.schoolId, q.month),
      prisma.assignment.findMany({
        where: { teacherId: id }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, title: true, dueDate: true, createdAt: true, class: { select: { name: true } }, subject: { select: { name: true } }, _count: { select: { submissions: true } } },
      }),
      prisma.diaryEntry.findMany({
        where: { teacherId: id }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { id: true, title: true, isHomework: true, createdAt: true, class: { select: { name: true } } },
      }),
    ]);
    return {
      teacher: teacherRow(teacher, metrics.get(id)!),
      attendance,
      recentAssignments: assignments.map((a) => ({ id: a.id, title: a.title, class: a.class.name, subject: a.subject.name, dueDate: a.dueDate, createdAt: a.createdAt, submissions: a._count.submissions })),
      recentDiary: diary.map((d) => ({ id: d.id, title: d.title, class: d.class.name, isHomework: d.isHomework, createdAt: d.createdAt })),
    };
  },
};

const teacherSelect = {
  id: true, userId: true, schoolId: true, employeeId: true,
  user: { select: { firstName: true, lastName: true, email: true, lastLoginAt: true } },
  subjects: { select: { subject: { select: { name: true } } } },
  classes: { select: { class: { select: { name: true } }, section: { select: { name: true } } } },
} satisfies Prisma.TeacherSelect;

const teacherRow = (t: Prisma.TeacherGetPayload<{ select: typeof teacherSelect }>, m: import('./progress.metrics').TeacherMetrics) => ({
  teacherId: t.id,
  name: `${t.user.firstName} ${t.user.lastName}`,
  email: t.user.email,
  employeeId: t.employeeId,
  subjects: t.subjects.map((s) => s.subject.name),
  classes: t.classes.map((c) => `${c.class.name} - ${c.section.name}`),
  lastActiveAt: t.user.lastLoginAt,
  ...m,
});
