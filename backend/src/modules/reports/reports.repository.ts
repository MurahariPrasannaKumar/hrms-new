import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const reportsRepository = {
  attendanceByStudent: (where: Prisma.AttendanceRecordWhereInput) =>
    prisma.attendanceRecord.groupBy({ by: ['studentId', 'status'], where, _count: { _all: true } }),
  students: (ids: string[]) =>
    prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, admissionNumber: true, class: { select: { name: true } }, section: { select: { name: true } } } }),

  examAverages: (where: Prisma.ExamResultWhereInput) =>
    prisma.examResult.groupBy({ by: ['examId'], where, _avg: { marks: true }, _max: { marks: true }, _min: { marks: true }, _count: { _all: true } }),
  exams: (ids: string[]) =>
    prisma.exam.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, maxMarks: true, class: { select: { name: true } }, subject: { select: { name: true } } } }),

  enrollment: (where: Prisma.StudentWhereInput) =>
    prisma.student.groupBy({ by: ['classId', 'status'], where, _count: { _all: true } }),
  classes: (ids: string[]) => prisma.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),

  schoolStats: (schoolId?: string) =>
    prisma.school.findMany({
      where: schoolId ? { id: schoolId } : {},
      select: { id: true, name: true, code: true, _count: { select: { students: true, teachers: true, staff: true, classes: true, users: true } } },
      orderBy: { name: 'asc' },
    }),

  activity: (where: Prisma.AuditLogWhereInput) =>
    prisma.auditLog.groupBy({ by: ['action', 'resource'], where, _count: { _all: true }, orderBy: { _count: { action: 'desc' } } }),
  logins: (where: Prisma.LoginAttemptWhereInput) => prisma.loginAttempt.groupBy({ by: ['success'], where, _count: { _all: true } }),
};
