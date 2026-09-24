import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const listSelect = {
  id: true, schoolId: true, admissionNumber: true, firstName: true, lastName: true, gender: true,
  email: true, phone: true, status: true, profileImageUrl: true, classId: true, sectionId: true,
  createdAt: true,
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  parent: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.StudentSelect;

export const studentsRepository = {
  list: (where: Prisma.StudentWhereInput, orderBy: Prisma.StudentOrderByWithRelationInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.student.findMany({ where, orderBy, skip, take, select: listSelect }),
      prisma.student.count({ where }),
    ]),

  findProfile: (where: Prisma.StudentWhereInput) =>
    prisma.student.findFirst({
      where,
      include: {
        class: { select: { id: true, name: true, level: true } },
        section: { select: { id: true, name: true } },
        parent: { select: { id: true, phone: true, user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        user: { select: { id: true, email: true, status: true, lastLoginAt: true } },
      },
    }),

  findScoped: (where: Prisma.StudentWhereInput) => prisma.student.findFirst({ where }),

  attendanceSummary: (studentId: string) =>
    prisma.attendanceRecord.groupBy({ by: ['status'], where: { studentId }, _count: { _all: true } }),

  recentAttendance: (studentId: string) =>
    prisma.attendanceRecord.findMany({
      where: { studentId }, take: 10, orderBy: { attendance: { date: 'desc' } },
      select: { id: true, status: true, remark: true, attendance: { select: { date: true } } },
    }),

  results: (studentId: string) =>
    prisma.examResult.findMany({
      where: { studentId },
      select: { id: true, marks: true, grade: true, exam: { select: { id: true, name: true, date: true, maxMarks: true, subject: { select: { name: true } } } } },
    }),

  assignments: (classId: string, studentId: string) =>
    prisma.assignment.findMany({
      where: { classId }, orderBy: { dueDate: 'asc' }, take: 20,
      select: {
        id: true, title: true, dueDate: true, subject: { select: { name: true } },
        submissions: { where: { studentId }, select: { submittedAt: true, marks: true } },
      },
    }),

  teacherAssignments: (userId: string) =>
    prisma.teacher.findUnique({ where: { userId }, select: { classes: { select: { classId: true, sectionId: true } } } }),

  studentRoleId: () => prisma.role.findUniqueOrThrow({ where: { name: 'STUDENT' }, select: { id: true } }),
};
