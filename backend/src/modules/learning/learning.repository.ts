import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const courseDetailInclude = {
  modules: {
    orderBy: { sortOrder: 'asc' },
    include: { lessons: { orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.CourseInclude;

const resourceInclude = {
  class: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.LearningResourceInclude;

export const learningRepository = {
  listCourses: (where: Prisma.CourseWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { modules: { select: { lessons: { select: { id: true } } } } },
      }),
      prisma.course.count({ where }),
    ]),
  findCourse: (id: string) => prisma.course.findUnique({ where: { id }, include: courseDetailInclude }),
  createCourse: (data: Prisma.CourseCreateInput) => prisma.course.create({ data, include: courseDetailInclude }),
  updateCourse: (id: string, data: Prisma.CourseUpdateInput) => prisma.course.update({ where: { id }, data }),
  deleteCourse: (id: string) => prisma.course.delete({ where: { id } }),

  findLesson: (id: string) =>
    prisma.lesson.findUnique({ where: { id }, include: { module: { include: { course: true } } } }),
  upsertProgress: (userId: string, lessonId: string) =>
    prisma.learningProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completed: true, completedAt: new Date() },
      create: { userId, lessonId, completed: true, completedAt: new Date() },
    }),
  completedLessonIds: async (userId: string, lessonIds: string[]) =>
    (
      await prisma.learningProgress.findMany({
        where: { userId, completed: true, lessonId: { in: lessonIds } },
        select: { lessonId: true },
      })
    ).map((p) => p.lessonId),
  progressForUser: (userId: string) =>
    prisma.learningProgress.findMany({ where: { userId, completed: true }, select: { lessonId: true } }),

  visibleCoursesWithLessons: (where: Prisma.CourseWhereInput) =>
    prisma.course.findMany({
      where,
      select: { id: true, title: true, modules: { select: { lessons: { select: { id: true } } } } },
    }),

  listPaths: (where: Prisma.LearningPathWhereInput) =>
    prisma.learningPath.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { courses: { orderBy: { sortOrder: 'asc' } } },
    }),
  findPath: (id: string) =>
    prisma.learningPath.findUnique({ where: { id }, include: { courses: { orderBy: { sortOrder: 'asc' } } } }),
  createPath: (data: Prisma.LearningPathCreateInput) =>
    prisma.learningPath.create({ data, include: { courses: { orderBy: { sortOrder: 'asc' } } } }),
  deletePath: (id: string) => prisma.learningPath.delete({ where: { id } }),

  listResources: (where: Prisma.LearningResourceWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.learningResource.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: resourceInclude }),
      prisma.learningResource.count({ where }),
    ]),
  findResource: (id: string) => prisma.learningResource.findUnique({ where: { id }, include: resourceInclude }),
  createResource: (data: Prisma.LearningResourceUncheckedCreateInput) => prisma.learningResource.create({ data }),
  updateResource: (id: string, data: Prisma.LearningResourceUncheckedUpdateInput) =>
    prisma.learningResource.update({ where: { id }, data }),
  deleteResource: (id: string) => prisma.learningResource.delete({ where: { id } }),
  categories: (where: Prisma.LearningResourceWhereInput) =>
    prisma.learningResource.groupBy({ by: ['category'], where, _count: { _all: true } }),
};
