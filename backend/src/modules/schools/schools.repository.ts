import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const schoolsRepository = {
  list(where: Prisma.SchoolWhereInput, orderBy: Prisma.SchoolOrderByWithRelationInput, skip: number, take: number) {
    return Promise.all([
      prisma.school.findMany({
        where, orderBy, skip, take,
        include: { _count: { select: { students: true, teachers: true, users: true } } },
      }),
      prisma.school.count({ where }),
    ]);
  },
  findById: (id: string) =>
    prisma.school.findUnique({
      where: { id },
      include: { settings: true, _count: { select: { students: true, teachers: true, staff: true, users: true, classes: true } } },
    }),
  create: (data: Prisma.SchoolCreateInput) => prisma.school.create({ data: { ...data, settings: { create: {} } } }),
  update: (id: string, data: Prisma.SchoolUpdateInput) => prisma.school.update({ where: { id }, data }),
  remove: (id: string) => prisma.school.delete({ where: { id } }),
};
