import { prisma } from '../../config/database';
import { pct, weekdaysBetween, localDateString } from '../attendance/attendance-stats';

export type Risk = 'ok' | 'watch' | 'at_risk';

/** at_risk: attendance < 75% or exam average < 40%. watch: attendance < 85% or average < 55%. Missing data never raises risk. */
export const riskOf = (attendancePct: number | null, avgExamPct: number | null): Risk => {
  if ((attendancePct !== null && attendancePct < 75) || (avgExamPct !== null && avgExamPct < 40)) return 'at_risk';
  if ((attendancePct !== null && attendancePct < 85) || (avgExamPct !== null && avgExamPct < 55)) return 'watch';
  return 'ok';
};
export const RISK_ORDER: Record<Risk, number> = { at_risk: 0, watch: 1, ok: 2 };

export interface StudentMetrics {
  attendancePct: number | null;
  avgExamPct: number | null;
  assignmentsSubmitted: number;
  assignmentsTotal: number;
  lessonsCompleted: number;
  riskLevel: Risk;
}
interface StudentRef { id: string; userId: string | null; classId: string | null }

const round1 = (n: number) => Math.round(n * 10) / 10;

/** A handful of grouped queries for any number of students (no per-student queries). */
export const studentMetrics = async (students: StudentRef[]): Promise<Map<string, StudentMetrics>> => {
  const out = new Map<string, StudentMetrics>();
  if (!students.length) return out;
  const ids = students.map((s) => s.id);
  const userIds = students.map((s) => s.userId).filter((x): x is string => !!x);
  const classIds = [...new Set(students.map((s) => s.classId).filter((x): x is string => !!x))];

  const [att, results, submitted, assignmentsByClass, lessons] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ['studentId', 'status'], where: { studentId: { in: ids } }, _count: { _all: true } }),
    prisma.examResult.findMany({ where: { studentId: { in: ids } }, select: { studentId: true, marks: true, exam: { select: { maxMarks: true } } } }),
    prisma.assignmentSubmission.groupBy({ by: ['studentId'], where: { studentId: { in: ids } }, _count: { _all: true } }),
    prisma.assignment.groupBy({ by: ['classId'], where: { classId: { in: classIds } }, _count: { _all: true } }),
    userIds.length
      ? prisma.learningProgress.groupBy({ by: ['userId'], where: { userId: { in: userIds }, completed: true }, _count: { _all: true } })
      : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
  ]);

  const attTotals = new Map<string, { attended: number; total: number }>();
  for (const g of att) {
    const t = attTotals.get(g.studentId) ?? { attended: 0, total: 0 };
    t.total += g._count._all;
    if (g.status === 'PRESENT' || g.status === 'LATE') t.attended += g._count._all;
    attTotals.set(g.studentId, t);
  }
  const examTotals = new Map<string, number[]>();
  for (const r of results) {
    if (!r.exam.maxMarks) continue;
    const list = examTotals.get(r.studentId) ?? [];
    list.push((r.marks / r.exam.maxMarks) * 100);
    examTotals.set(r.studentId, list);
  }
  const submittedBy = new Map(submitted.map((g) => [g.studentId, g._count._all]));
  const totalByClass = new Map(assignmentsByClass.map((g) => [g.classId, g._count._all]));
  const lessonsBy = new Map(lessons.map((g) => [g.userId, g._count._all]));

  for (const s of students) {
    const a = attTotals.get(s.id);
    const e = examTotals.get(s.id);
    const attendancePct = a && a.total ? pct(a.attended, a.total) : null;
    const avgExamPct = e?.length ? round1(e.reduce((x, y) => x + y, 0) / e.length) : null;
    out.set(s.id, {
      attendancePct,
      avgExamPct,
      assignmentsSubmitted: submittedBy.get(s.id) ?? 0,
      assignmentsTotal: s.classId ? totalByClass.get(s.classId) ?? 0 : 0,
      lessonsCompleted: s.userId ? lessonsBy.get(s.userId) ?? 0 : 0,
      riskLevel: riskOf(attendancePct, avgExamPct),
    });
  }
  return out;
};

export interface TeacherMetrics {
  attendancePct: number | null;
  daysAttendanceMarked30d: number;
  assignmentsCreated: number;
  diaryEntries30d: number;
  noticesPublished: number;
}
interface TeacherRef { id: string; userId: string; schoolId: string }

export const teacherMetrics = async (teachers: TeacherRef[]): Promise<Map<string, TeacherMetrics>> => {
  const out = new Map<string, TeacherMetrics>();
  if (!teachers.length) return out;
  const ids = teachers.map((t) => t.id);
  const userIds = teachers.map((t) => t.userId);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since2 = new Date(Date.now() - 2 * 86_400_000);

  const [zones, checkIns, recent, marked, assignments, diary, notices] = await Promise.all([
    prisma.schoolSetting.findMany({ where: { schoolId: { in: [...new Set(teachers.map((t) => t.schoolId))] } }, select: { schoolId: true, timezone: true } }),
    prisma.teacherAttendance.groupBy({ by: ['teacherId'], where: { teacherId: { in: ids } }, _count: { _all: true }, _min: { date: true } }),
    prisma.teacherAttendance.findMany({ where: { teacherId: { in: ids }, date: { gte: since2 } }, select: { teacherId: true, date: true } }),
    prisma.attendance.groupBy({ by: ['markedById'], where: { markedById: { in: userIds }, date: { gte: since30 } }, _count: { _all: true } }),
    prisma.assignment.groupBy({ by: ['teacherId'], where: { teacherId: { in: ids } }, _count: { _all: true } }),
    prisma.diaryEntry.groupBy({ by: ['teacherId'], where: { teacherId: { in: ids }, createdAt: { gte: since30 } }, _count: { _all: true } }),
    prisma.notice.groupBy({ by: ['authorId'], where: { authorId: { in: userIds }, isPublished: true }, _count: { _all: true } }),
  ]);

  const tzBySchool = new Map(zones.map((z) => [z.schoolId, z.timezone]));
  const checkBy = new Map(checkIns.map((c) => [c.teacherId, c]));
  const recentBy = new Map<string, Set<string>>();
  for (const r of recent) {
    const set = recentBy.get(r.teacherId) ?? new Set<string>();
    set.add(r.date.toISOString().slice(0, 10));
    recentBy.set(r.teacherId, set);
  }
  const markedBy = new Map(marked.map((g) => [g.markedById, g._count._all]));
  const assignBy = new Map(assignments.map((g) => [g.teacherId, g._count._all]));
  const diaryBy = new Map(diary.map((g) => [g.teacherId, g._count._all]));
  const noticeBy = new Map(notices.map((g) => [g.authorId, g._count._all]));

  for (const t of teachers) {
    const c = checkBy.get(t.id);
    let attendancePct: number | null = null;
    if (c?._min.date) {
      const todayStr = localDateString(tzBySchool.get(t.schoolId) ?? 'UTC');
      const checkedToday = recentBy.get(t.id)?.has(todayStr) ?? false;
      const dow = new Date(`${todayStr}T00:00:00Z`).getUTCDay();
      const first = c._min.date.toISOString().slice(0, 10);
      let workingDays = weekdaysBetween(first, todayStr).length;
      if (!checkedToday && dow !== 0 && dow !== 6) workingDays -= 1;
      attendancePct = pct(c._count._all, Math.max(workingDays, c._count._all));
    }
    out.set(t.id, {
      attendancePct,
      daysAttendanceMarked30d: markedBy.get(t.userId) ?? 0,
      assignmentsCreated: assignBy.get(t.id) ?? 0,
      diaryEntries30d: diaryBy.get(t.id) ?? 0,
      noticesPublished: noticeBy.get(t.userId) ?? 0,
    });
  }
  return out;
};
