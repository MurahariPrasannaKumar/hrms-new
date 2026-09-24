import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { learningRepository as repo } from './learning.repository';

const isSuper = (u: AuthUser) => u.role === 'SUPER_ADMIN';
const canManage = (u: AuthUser) => u.permissions.includes('learning.manage');

/** Own school's content + platform-wide (schoolId null) content. SUPER_ADMIN may narrow to one school. */
const visibleSchool = (u: AuthUser, requested?: string): { OR: { schoolId: string | null }[] } | Record<string, never> => {
  if (isSuper(u)) return requested ? { OR: [{ schoolId: requested }, { schoolId: null }] } : {};
  return { OR: [{ schoolId: u.schoolId }, { schoolId: null }] };
};

const assertVisible = (u: AuthUser, schoolId: string | null) => {
  if (isSuper(u) || schoolId === null || schoolId === u.schoolId) return;
  throw ApiError.notFound(); // do not reveal other tenants' content
};
const assertWritable = (u: AuthUser, schoolId: string | null) => {
  if (isSuper(u)) return;
  if (schoolId === u.schoolId) return;
  if (schoolId === null) throw ApiError.forbidden('Platform-wide content is read-only');
  throw ApiError.notFound();
};

const writeTarget = (u: AuthUser, input: { schoolId?: string; global?: boolean }): string | null => {
  if (!isSuper(u)) return u.schoolId;
  if (input.global) return null;
  if (!input.schoolId) throw ApiError.badRequest('schoolId or global=true is required for platform administrators');
  return input.schoolId;
};

const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

export const learningService = {
  async listCourses(u: AuthUser, q: PaginationQuery & { category?: string; schoolId?: string }) {
    const where: Prisma.CourseWhereInput = {
      ...visibleSchool(u, q.schoolId),
      ...(canManage(u) ? {} : { published: true }),
      ...(q.category ? { category: q.category } : {}),
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await repo.listCourses(where, pageArgs(q).skip, pageArgs(q).take);
    const done = new Set((await repo.progressForUser(u.id)).map((p) => p.lessonId));
    const items = rows.map(({ modules, ...c }) => {
      const ids = modules.flatMap((m) => m.lessons.map((l) => l.id));
      const completed = ids.filter((id) => done.has(id)).length;
      return { ...c, moduleCount: modules.length, lessonCount: ids.length, completionPercent: percent(completed, ids.length) };
    });
    return { items, meta: pageMeta(q, total) };
  },

  async getCourse(u: AuthUser, id: string) {
    const course = await repo.findCourse(id);
    if (!course) throw ApiError.notFound('Course not found');
    assertVisible(u, course.schoolId);
    if (!course.published && !canManage(u)) throw ApiError.notFound('Course not found');
    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const done = new Set(await repo.completedLessonIds(u.id, lessonIds));
    const modules = course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l, completed: done.has(l.id) })),
    }));
    return { ...course, modules, lessonCount: lessonIds.length, completedLessons: done.size, completionPercent: percent(done.size, lessonIds.length) };
  },

  async createCourse(u: AuthUser, input: {
    title: string; description?: string; category?: string; published: boolean; schoolId?: string; global: boolean;
    modules: { title: string; sortOrder: number; lessons: { title: string; content?: string; videoUrl?: string; sortOrder: number }[] }[];
  }) {
    const schoolId = writeTarget(u, input);
    return repo.createCourse({
      title: input.title,
      description: input.description,
      category: input.category,
      published: input.published,
      ...(schoolId ? { school: { connect: { id: schoolId } } } : {}),
      modules: { create: input.modules.map((m) => ({ title: m.title, sortOrder: m.sortOrder, lessons: { create: m.lessons } })) },
    });
  },

  async updateCourse(u: AuthUser, id: string, data: Prisma.CourseUpdateInput) {
    const course = await repo.findCourse(id);
    if (!course) throw ApiError.notFound('Course not found');
    assertWritable(u, course.schoolId);
    return repo.updateCourse(id, data);
  },

  async deleteCourse(u: AuthUser, id: string) {
    const course = await repo.findCourse(id);
    if (!course) throw ApiError.notFound('Course not found');
    assertWritable(u, course.schoolId);
    await repo.deleteCourse(id);
    return course;
  },

  async completeLesson(u: AuthUser, lessonId: string) {
    const lesson = await repo.findLesson(lessonId);
    if (!lesson) throw ApiError.notFound('Lesson not found');
    assertVisible(u, lesson.module.course.schoolId);
    await repo.upsertProgress(u.id, lessonId);
    const course = await this.getCourse(u, lesson.module.courseId);
    return { lessonId, courseId: course.id, completionPercent: course.completionPercent };
  },

  async progress(u: AuthUser) {
    const courses = await repo.visibleCoursesWithLessons({ ...visibleSchool(u), published: true });
    const done = new Set((await repo.progressForUser(u.id)).map((p) => p.lessonId));
    const items = courses
      .map((c) => {
        const ids = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
        const completed = ids.filter((id) => done.has(id)).length;
        return { courseId: c.id, title: c.title, totalLessons: ids.length, completedLessons: completed, completionPercent: percent(completed, ids.length) };
      })
      .filter((c) => c.completedLessons > 0);
    return { items, overallLessonsCompleted: done.size };
  },

  async certificates(u: AuthUser) {
    const { items } = await this.progress(u);
    // Placeholder: real certificate issuing/PDF generation is not implemented yet.
    return {
      placeholder: true,
      items: items.filter((c) => c.completionPercent === 100 && c.totalLessons > 0).map((c) => ({
        courseId: c.courseId, courseTitle: c.title, status: 'ELIGIBLE', url: null,
      })),
    };
  },

  // ── learning paths ──
  async listPaths(u: AuthUser) {
    const paths = await repo.listPaths(visibleSchool(u));
    const courseIds = [...new Set(paths.flatMap((p) => p.courses.map((c) => c.courseId)))];
    const courses = await repo.visibleCoursesWithLessons({ id: { in: courseIds } });
    const done = new Set((await repo.progressForUser(u.id)).map((p) => p.lessonId));
    const byId = new Map(courses.map((c) => [c.id, c]));
    return paths.map((p) => {
      const list = p.courses.map((pc) => byId.get(pc.courseId)).filter((c): c is NonNullable<typeof c> => !!c);
      const lessons = list.flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
      return {
        id: p.id, title: p.title, description: p.description, schoolId: p.schoolId,
        courses: list.map((c) => ({ id: c.id, title: c.title })),
        completionPercent: percent(lessons.filter((id) => done.has(id)).length, lessons.length),
      };
    });
  },

  async createPath(u: AuthUser, input: { title: string; description?: string; courseIds: string[] }) {
    const schoolId = isSuper(u) ? null : u.schoolId;
    if (input.courseIds.length) {
      const found = await repo.visibleCoursesWithLessons({ id: { in: input.courseIds }, ...visibleSchool(u) });
      if (found.length !== new Set(input.courseIds).size) throw ApiError.badRequest('One or more courses are not available');
    }
    return repo.createPath({
      title: input.title,
      description: input.description,
      ...(schoolId ? { schoolId } : {}),
      courses: { create: input.courseIds.map((courseId, i) => ({ courseId, sortOrder: i })) },
    });
  },

  async deletePath(u: AuthUser, id: string) {
    const path = await repo.findPath(id);
    if (!path) throw ApiError.notFound('Learning path not found');
    assertWritable(u, path.schoolId);
    await repo.deletePath(id);
    return path;
  },

  // ── resources ──
  async listResources(u: AuthUser, q: PaginationQuery & { area?: string; category?: string; type?: string; schoolId?: string }) {
    const where: Prisma.LearningResourceWhereInput = {
      ...visibleSchool(u, q.schoolId),
      ...(q.area ? { area: q.area } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.type ? { type: q.type as Prisma.LearningResourceWhereInput['type'] } : {}),
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await repo.listResources(where, pageArgs(q).skip, pageArgs(q).take);
    return { items, meta: pageMeta(q, total) };
  },

  async getResource(u: AuthUser, id: string) {
    const r = await repo.findResource(id);
    if (!r) throw ApiError.notFound('Resource not found');
    assertVisible(u, r.schoolId);
    return r;
  },

  async createResource(u: AuthUser, input: Prisma.LearningResourceUncheckedCreateInput & { global?: boolean }) {
    const { global, ...rest } = input;
    const schoolId = writeTarget(u, { schoolId: rest.schoolId ?? undefined, global });
    return repo.createResource({ ...rest, schoolId });
  },

  async updateResource(u: AuthUser, id: string, data: Prisma.LearningResourceUncheckedUpdateInput) {
    const r = await repo.findResource(id);
    if (!r) throw ApiError.notFound('Resource not found');
    assertWritable(u, r.schoolId);
    return repo.updateResource(id, data);
  },

  async deleteResource(u: AuthUser, id: string) {
    const r = await repo.findResource(id);
    if (!r) throw ApiError.notFound('Resource not found');
    assertWritable(u, r.schoolId);
    await repo.deleteResource(id);
    return r;
  },

  async categories(u: AuthUser, area?: string) {
    const rows = await repo.categories({ ...visibleSchool(u), ...(area ? { area } : {}) });
    return rows.filter((r) => r.category).map((r) => ({ name: r.category as string, count: r._count._all }));
  },
};
