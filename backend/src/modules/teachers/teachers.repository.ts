import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const userSelect = { id: true, email: true, firstName: true, lastName: true, phone: true, status: true, lastLoginAt: true } as const;

export const teachersRepository = {
  list: (where: Prisma.TeacherWhereInput, orderBy: Prisma.TeacherOrderByWithRelationInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.teacher.findMany({
        where, orderBy, skip, take,
        select: {
          id: true, schoolId: true, employeeId: true, phone: true, qualification: true, joiningDate: true, createdAt: true,
          user: { select: userSelect },
          subjects: { select: { subject: { select: { id: true, name: true, code: true } } } },
          _count: { select: { classes: true } },
        },
      }),
      prisma.teacher.count({ where }),
    ]),

  findDetail: (where: Prisma.TeacherWhereInput) =>
    prisma.teacher.findFirst({
      where,
      include: {
        user: { select: userSelect },
        subjects: { select: { subject: { select: { id: true, name: true, code: true } } } },
        classes: { select: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } }, classId: true, sectionId: true } },
        _count: { select: { assignments: true, diaryEntries: true } },
      },
    }),

  findScoped: (where: Prisma.TeacherWhereInput) => prisma.teacher.findFirst({ where }),

  countStudents: (pairs: { classId: string; sectionId: string }[]) =>
    pairs.length ? prisma.student.count({ where: { OR: pairs } }) : Promise.resolve(0),

  teacherRoleId: () => prisma.role.findUniqueOrThrow({ where: { name: 'TEACHER' }, select: { id: true } }),
};
