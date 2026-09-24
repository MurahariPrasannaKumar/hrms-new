import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import {
  attendanceToday, attendanceTrend, cumulativeGrowth, isoDay, pct, performance, recentActivity, recentNotices,
  startOfTodayUtc, visibleNoticesWhere,
} from './dashboard.repository';

const DAY = 86_400_000;

export const dashboardService = {
  async admin() {
    const since = new Date(startOfTodayUtc().getTime() - 13 * DAY);
    const [totalSchools, activeSchools, totalStudents, totalTeachers, totalStaff, activeUsers, inactiveSchools, suspendedUsers,
      today, trend, studentGrowth, schoolGrowth, logins, modules, disabled, activity] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { status: 'ACTIVE' } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.staff.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.school.count({ where: { status: 'INACTIVE' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      attendanceToday({}),
      attendanceTrend({}),
      cumulativeGrowth((before) => prisma.student.count({ where: { createdAt: { lt: before } } })),
      cumulativeGrowth((before) => prisma.school.count({ where: { createdAt: { lt: before } } })),
      prisma.loginAttempt.findMany({ where: { success: true, createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.module.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, key: true, name: true } }),
      prisma.schoolModule.groupBy({ by: ['moduleId'], where: { enabled: false }, _count: { _all: true } }),
      recentActivity(undefined, 10),
    ]);
    const perDay = new Map<string, number>();
    logins.forEach((l) => perDay.set(isoDay(l.createdAt), (perDay.get(isoDay(l.createdAt)) ?? 0) + 1));
    const userActivity = Array.from({ length: 14 }, (_, i) => {
      const date = isoDay(new Date(since.getTime() + i * DAY));
      return { date, logins: perDay.get(date) ?? 0 };
    });
    const off = new Map(disabled.map((d) => [d.moduleId, d._count._all]));
    return {
      stats: { totalSchools, activeSchools, totalStudents, totalTeachers, totalStaff, activeUsers, attendanceTodayPct: today, pendingActions: inactiveSchools + suspendedUsers },
      charts: {
        studentGrowth, schoolGrowth, attendanceTrend: trend, userActivity,
        moduleUsage: modules.map((m) => ({ module: m.name, key: m.key, schools: Math.max(0, totalSchools - (off.get(m.id) ?? 0)) })),
      },
      recentActivity: activity,
    };
  },

  async school(user: AuthUser) {
    const schoolId = user.schoolId;
    if (!schoolId) throw ApiError.forbidden('Account is not associated with a school');
    const now = new Date();
    const [totalStudents, totalTeachers, totalClasses, today, trend, pendingAssignments, notices, events, distribution, perf, activity] = await Promise.all([
      prisma.student.count({ where: { schoolId, status: 'ACTIVE' } }),
      prisma.teacher.count({ where: { schoolId } }),
      prisma.class.count({ where: { schoolId } }),
      attendanceToday({ schoolId }),
      attendanceTrend({ schoolId }),
      prisma.assignment.count({ where: { schoolId, dueDate: { gte: now } } }),
      recentNotices(schoolId, user.role),
      prisma.notice.findMany({
        where: { schoolId, isPublished: true, type: { in: ['EVENT', 'HOLIDAY'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, type: true, publishAt: true, expiresAt: true },
      }),
      prisma.class.findMany({ where: { schoolId }, orderBy: { name: 'asc' }, select: { name: true, _count: { select: { students: true } } } }),
      performance({ schoolId }),
      recentActivity(schoolId, 8),
    ]);
    return {
      stats: { totalStudents, totalTeachers, totalClasses, attendanceTodayPct: today, pendingAssignments },
      recentNotices: notices,
      upcomingEvents: events,
      academicPerformance: { averagePct: perf.averagePct, bySubject: perf.bySubject },
      charts: {
        attendanceTrend: trend,
        studentDistribution: distribution.map((c) => ({ class: c.name, count: c._count.students })),
        classPerformance: perf.byClass,
      },
      recentActivity: activity,
    };
  },

  async teacher(user: AuthUser) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: user.id },
      include: { classes: { include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true, _count: { select: { students: true } } } } } } },
    });
    if (!teacher) throw ApiError.notFound('Teacher profile not found');
    const schoolId = teacher.schoolId;
    const sectionIds = teacher.classes.map((c) => c.sectionId);
    const classIds = [...new Set(teacher.classes.map((c) => c.classId))];
    const now = new Date();
    const todayDate = startOfTodayUtc();
    const [trend, marked, pendingAssignments, diary, notices] = await Promise.all([
      attendanceTrend({ sectionIds }),
      prisma.attendance.findMany({ where: { sectionId: { in: sectionIds }, date: todayDate }, select: { sectionId: true } }),
      prisma.assignment.count({ where: { teacherId: teacher.id, dueDate: { gte: now } } }),
      prisma.diaryEntry.findMany({ where: { teacherId: teacher.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, isHomework: true, dueDate: true, createdAt: true } }),
      recentNotices(schoolId, user.role, classIds),
    ]);
    const done = new Set(marked.map((m) => m.sectionId));
    return {
      stats: {
        assignedClasses: teacher.classes.length,
        totalStudents: teacher.classes.reduce((n, c) => n + c.section._count.students, 0),
        pendingAssignments,
        attendancePending: sectionIds.filter((s) => !done.has(s)).length,
      },
      classes: teacher.classes.map((c) => ({
        classId: c.classId, className: c.class.name, sectionId: c.sectionId, sectionName: c.section.name,
        studentCount: c.section._count.students, attendanceMarkedToday: done.has(c.sectionId),
      })),
      charts: { attendanceTrend: trend },
      recentDiary: diary,
      recentNotices: notices,
    };
  },

  async student(user: AuthUser) {
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
    });
    if (!student) throw ApiError.notFound('Student profile not found');
    return studentSummary(student.id, user.role, true);
  },

  async parent(user: AuthUser) {
    const parent = await prisma.parent.findUnique({ where: { userId: user.id }, include: { children: { select: { id: true } } } });
    if (!parent) throw ApiError.notFound('Parent profile not found');
    const children = await Promise.all(parent.children.map((c) => studentSummary(c.id, user.role, false)));
    const classIds = children.flatMap((c) => (c.student.classId ? [c.student.classId] : []));
    return {
      children: children.map(({ student, attendance, performance: perf, upcomingAssignments }) => ({
        ...student, attendance, averagePct: perf.averagePct, upcomingAssignments: upcomingAssignments.length,
      })),
      recentNotices: await recentNotices(parent.schoolId, user.role, classIds),
    };
  },
};

async function studentSummary(studentId: string, role: string, full: boolean) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
  });
  const now = new Date();
  const [grouped, perf, assignments, diary, notices, lessons] = await Promise.all([
    prisma.attendanceRecord.groupBy({ by: ['status'], where: { studentId }, _count: { _all: true } }),
    performance({ studentId }),
    student.classId
      ? prisma.assignment.findMany({
          where: { classId: student.classId, schoolId: student.schoolId, dueDate: { gte: now } },
          orderBy: { dueDate: 'asc' }, take: 5,
          select: { id: true, title: true, dueDate: true, subject: { select: { name: true } }, submissions: { where: { studentId }, select: { id: true } } },
        })
      : [],
    full && student.classId
      ? prisma.diaryEntry.findMany({
          where: { schoolId: student.schoolId, classId: student.classId, OR: [{ sectionId: null }, { sectionId: student.sectionId }] },
          orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, isHomework: true, dueDate: true, createdAt: true },
        })
      : [],
    full ? recentNotices(student.schoolId, role, student.classId ? [student.classId] : []) : [],
    full && student.userId
      ? Promise.all([
          prisma.lesson.count({ where: { module: { course: { published: true, OR: [{ schoolId: student.schoolId }, { schoolId: null }] } } } }),
          prisma.learningProgress.count({ where: { userId: student.userId, completed: true } }),
        ])
      : [0, 0],
  ]);
  const count = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = grouped.reduce((n, g) => n + g._count._all, 0);
  const attended = count('PRESENT') + count('LATE');
  return {
    student: {
      id: student.id, name: `${student.firstName} ${student.lastName}`, admissionNumber: student.admissionNumber,
      classId: student.classId, className: student.class?.name ?? null, sectionId: student.sectionId, sectionName: student.section?.name ?? null,
    },
    attendance: { percent: pct(attended, total), total, present: count('PRESENT'), absent: count('ABSENT'), late: count('LATE'), excused: count('EXCUSED') },
    performance: perf,
    upcomingAssignments: assignments.map((a) => ({ id: a.id, title: a.title, dueDate: a.dueDate, subject: a.subject.name, submitted: a.submissions.length > 0 })),
    recentDiary: diary,
    recentNotices: notices,
    learning: { completedLessons: lessons[1], totalLessons: lessons[0], progressPct: pct(lessons[1], lessons[0]) },
  };
}

export { visibleNoticesWhere };
