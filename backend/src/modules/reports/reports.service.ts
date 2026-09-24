import type { Request } from 'express';
import { optionalSchoolScope } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import { getTeacherContext } from '../../utils/actor';
import { reportsRepository as repo } from './reports.repository';
import type { ReportQuery } from './reports.validation';

type Row = Record<string, string | number | null>;
const round1 = (n: number) => Math.round(n * 10) / 10;
const range = (q: ReportQuery) => (q.from || q.to ? { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } : undefined);

const studentAttendance = async (req: Request, q: ReportQuery, schoolId?: string): Promise<Row[]> => {
  const att: Record<string, unknown> = {};
  if (range(q)) att.date = range(q);
  if (q.sectionId) att.sectionId = q.sectionId;
  if (q.classId) att.section = { classId: q.classId };
  if (req.user!.role === 'TEACHER') {
    const allowed = (await getTeacherContext(req.user!.id))?.sectionIds ?? [];
    if (q.sectionId && !allowed.includes(q.sectionId)) throw ApiError.forbidden('You are not assigned to this section');
    if (!q.sectionId) att.sectionId = { in: allowed };
  }
  const groups = await repo.attendanceByStudent({ ...(schoolId ? { schoolId } : {}), ...(Object.keys(att).length ? { attendance: att } : {}) });
  const students = new Map((await repo.students([...new Set(groups.map((g) => g.studentId))])).map((s) => [s.id, s]));
  const byStudent = new Map<string, Record<string, number>>();
  for (const g of groups) {
    const c = byStudent.get(g.studentId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    c[g.status] = g._count._all;
    byStudent.set(g.studentId, c);
  }
  return [...byStudent.entries()]
    .map(([id, c]) => {
      const s = students.get(id);
      const total = c.PRESENT + c.ABSENT + c.LATE + c.EXCUSED;
      return {
        admissionNumber: s?.admissionNumber ?? '', student: s ? `${s.firstName} ${s.lastName}` : id,
        class: s?.class?.name ?? '', section: s?.section?.name ?? '',
        present: c.PRESENT, absent: c.ABSENT, late: c.LATE, excused: c.EXCUSED, total,
        percentage: total ? round1(((c.PRESENT + c.LATE) / total) * 100) : 0,
      };
    })
    .sort((a, b) => a.student.localeCompare(b.student));
};

const academicPerformance = async (q: ReportQuery, schoolId?: string): Promise<Row[]> => {
  const where = {
    ...(schoolId ? { schoolId } : {}),
    exam: { ...(q.classId ? { classId: q.classId } : {}), ...(range(q) ? { date: range(q) } : {}) },
  };
  const groups = await repo.examAverages(where);
  const exams = new Map((await repo.exams(groups.map((g) => g.examId))).map((e) => [e.id, e]));
  return groups.map((g) => {
    const e = exams.get(g.examId);
    return {
      exam: e?.name ?? g.examId, class: e?.class.name ?? '', subject: e?.subject.name ?? '', maxMarks: e?.maxMarks ?? null,
      students: g._count._all, average: round1(g._avg.marks ?? 0), highest: g._max.marks, lowest: g._min.marks,
    };
  });
};

const enrollment = async (q: ReportQuery, schoolId?: string): Promise<Row[]> => {
  const groups = await repo.enrollment({ ...(schoolId ? { schoolId } : {}), ...(q.classId ? { classId: q.classId } : {}) });
  const classes = new Map((await repo.classes(groups.map((g) => g.classId).filter((x): x is string => !!x))).map((c) => [c.id, c.name]));
  return groups.map((g) => ({ class: g.classId ? (classes.get(g.classId) ?? g.classId) : 'Unassigned', status: g.status, students: g._count._all }));
};

const userActivity = async (q: ReportQuery, schoolId?: string): Promise<Row[]> => {
  const createdAt = range(q);
  const audit = await repo.activity({ ...(schoolId ? { schoolId } : {}), ...(createdAt ? { createdAt } : {}) });
  const rows: Row[] = audit.map((a) => ({ action: a.action, resource: a.resource, count: a._count._all }));
  if (!schoolId) {
    for (const l of await repo.logins({ ...(createdAt ? { createdAt } : {}) })) {
      rows.push({ action: l.success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED', resource: 'AUTH', count: l._count._all });
    }
  }
  return rows;
};

export const reportsService = {
  async run(req: Request, type: string, q: ReportQuery): Promise<{ rows: Row[]; note?: string }> {
    const role = req.user!.role;
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const adminOnly = ['school-statistics', 'user-activity', 'teacher-attendance'].includes(type);
    if (adminOnly && role !== 'SUPER_ADMIN' && role !== 'SCHOOL_ADMIN') throw ApiError.forbidden();
    if (type === 'student-attendance') return { rows: await studentAttendance(req, q, schoolId) };
    if (type === 'academic-performance') return { rows: await academicPerformance(q, schoolId) };
    if (type === 'enrollment') return { rows: await enrollment(q, schoolId) };
    if (type === 'user-activity') return { rows: await userActivity(q, schoolId) };
    if (type === 'school-statistics') {
      const schools = await repo.schoolStats(schoolId);
      return { rows: schools.map((s) => ({ school: s.name, code: s.code, students: s._count.students, teachers: s._count.teachers, staff: s._count.staff, classes: s._count.classes, users: s._count.users })) };
    }
    return { rows: [], note: 'Teacher attendance tracking is not implemented yet.' };
  },
};
