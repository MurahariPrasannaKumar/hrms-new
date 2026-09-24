import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const startOfTodayUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const pct = (num: number, den: number) => (den === 0 ? null : Math.round((num / den) * 1000) / 10);

export interface AttendanceScope {
  schoolId?: string;
  sectionIds?: string[];
  studentIds?: string[];
}

/** Daily attendance percentage (PRESENT + LATE counted as attended) for the last `days` days. */
export const attendanceTrend = async (scope: AttendanceScope, days = 14) => {
  const from = new Date(startOfTodayUtc().getTime() - (days - 1) * 86_400_000);
  const conds: Prisma.Sql[] = [Prisma.sql`a."date" >= ${isoDay(from)}::date`];
  if (scope.schoolId) conds.push(Prisma.sql`a."schoolId" = ${scope.schoolId}`);
  if (scope.sectionIds) conds.push(Prisma.sql`a."sectionId" IN (${Prisma.join(scope.sectionIds.length ? scope.sectionIds : [''])})`);
  if (scope.studentIds) conds.push(Prisma.sql`r."studentId" IN (${Prisma.join(scope.studentIds.length ? scope.studentIds : [''])})`);
  const rows = await prisma.$queryRaw<{ d: Date; total: number; present: number }[]>`
    SELECT a."date" AS d, count(*)::int AS total,
           count(*) FILTER (WHERE r."status" IN ('PRESENT', 'LATE'))::int AS present
    FROM "Attendance" a JOIN "AttendanceRecord" r ON r."attendanceId" = a."id"
    WHERE ${Prisma.join(conds, ' AND ')}
    GROUP BY a."date" ORDER BY a."date"`;
  return rows.map((r) => ({ date: isoDay(r.d), presentPct: pct(r.present, r.total) ?? 0, total: r.total }));
};

export const attendanceToday = async (scope: AttendanceScope) => {
  const today = isoDay(startOfTodayUtc());
  const row = (await attendanceTrend(scope, 1)).find((r) => r.date === today);
  return row ? row.presentPct : null;
};

/** Cumulative count at the end of each of the last `months` months. */
export const cumulativeGrowth = async (count: (before: Date) => Promise<number>, months = 6) => {
  const now = new Date();
  const out: { month: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
    out.push({ month: start.toISOString().slice(0, 7), count: await count(end) });
  }
  return out;
};

export const recentActivity = async (schoolId?: string, take = 10) => {
  const logs = await prisma.auditLog.findMany({
    where: schoolId ? { schoolId } : {},
    orderBy: { createdAt: 'desc' },
    take,
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  return logs.map((l) => ({
    id: l.id, action: l.action, resource: l.resource, resourceId: l.resourceId, schoolId: l.schoolId,
    user: l.user ? `${l.user.firstName} ${l.user.lastName}` : null, createdAt: l.createdAt,
  }));
};

/** Notices visible to a role/class set: published, in window, and untargeted or targeted at me. */
export const visibleNoticesWhere = (schoolId: string, role: string, classIds: string[] = []): Prisma.NoticeWhereInput => {
  const now = new Date();
  return {
    schoolId,
    isPublished: true,
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      { OR: [{ targets: { none: {} } }, { targets: { some: { roleName: role } } }, { targets: { some: { classId: { in: classIds } } } }] },
    ],
  };
};

export const recentNotices = (schoolId: string, role: string, classIds: string[] = [], take = 5) =>
  prisma.notice.findMany({
    where: visibleNoticesWhere(schoolId, role, classIds),
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, title: true, type: true, createdAt: true },
  });

/** Exam results -> percentage rollups (overall, by class, by subject). */
export const performance = async (where: Prisma.ExamResultWhereInput) => {
  const results = await prisma.examResult.findMany({
    where,
    select: { marks: true, studentId: true, exam: { select: { maxMarks: true, name: true, date: true, class: { select: { id: true, name: true } }, subject: { select: { name: true } } } } },
  });
  const rows = results.map((r) => ({ ...r, pct: (r.marks / r.exam.maxMarks) * 100 }));
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const group = (key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number[]>();
    rows.forEach((r) => m.set(key(r), [...(m.get(key(r)) ?? []), r.pct]));
    return [...m.entries()].map(([name, xs]) => ({ name, averagePct: avg(xs) }));
  };
  return {
    averagePct: avg(rows.map((r) => r.pct)),
    byClass: group((r) => r.exam.class.name).map((x) => ({ class: x.name, averagePct: x.averagePct })),
    bySubject: group((r) => r.exam.subject.name).map((x) => ({ subject: x.name, averagePct: x.averagePct })),
    recent: rows
      .sort((a, b) => b.exam.date.getTime() - a.exam.date.getTime())
      .slice(0, 5)
      .map((r) => ({ exam: r.exam.name, subject: r.exam.subject.name, marks: r.marks, maxMarks: r.exam.maxMarks, pct: Math.round(r.pct * 10) / 10 })),
  };
};

export { pct };
