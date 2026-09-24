import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });

export const searchRepository = {
  students: (q: string, where: Prisma.StudentWhereInput, take: number) =>
    prisma.student.findMany({
      where: { AND: [where, { OR: [{ firstName: contains(q) }, { lastName: contains(q) }, { admissionNumber: contains(q) }, { email: contains(q) }] }] },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, schoolId: true }, take, orderBy: { firstName: 'asc' },
    }),
  teachers: (q: string, schoolId: string | undefined, take: number) =>
    prisma.teacher.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        OR: [{ employeeId: contains(q) }, { user: { OR: [{ firstName: contains(q) }, { lastName: contains(q) }, { email: contains(q) }] } }],
      },
      select: { id: true, employeeId: true, schoolId: true, user: { select: { firstName: true, lastName: true, email: true } } }, take,
    }),
  schools: (q: string, take: number) =>
    prisma.school.findMany({
      where: { OR: [{ name: contains(q) }, { code: contains(q) }, { city: contains(q) }] },
      select: { id: true, name: true, code: true, city: true, status: true }, take, orderBy: { name: 'asc' },
    }),
  notices: (q: string, where: Prisma.NoticeWhereInput, take: number) =>
    prisma.notice.findMany({
      where: { AND: [where, { OR: [{ title: contains(q) }, { body: contains(q) }] }] },
      select: { id: true, title: true, type: true, createdAt: true }, take, orderBy: { createdAt: 'desc' },
    }),
  courses: (q: string, schoolId: string | undefined, take: number) =>
    prisma.course.findMany({
      where: {
        published: true,
        ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}),
        AND: [{ OR: [{ title: contains(q) }, { category: contains(q) }] }],
      },
      select: { id: true, title: true, category: true }, take,
    }),
  resources: (q: string, schoolId: string | undefined, take: number) =>
    prisma.learningResource.findMany({
      where: {
        ...(schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : {}),
        AND: [{ OR: [{ title: contains(q) }, { category: contains(q) }] }],
      },
      select: { id: true, title: true, type: true, area: true, category: true }, take,
    }),
};
