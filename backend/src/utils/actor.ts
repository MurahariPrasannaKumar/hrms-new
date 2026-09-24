import { prisma } from '../config/database';
import type { AuthUser } from '../types/express';

export const dateOnlyString = /^\d{4}-\d{2}-\d{2}/;
export const toUtcDate = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`);

export const getTeacherContext = async (userId: string) => {
  const t = await prisma.teacher.findUnique({ where: { userId }, include: { classes: true } });
  if (!t) return null;
  return {
    teacherId: t.id,
    classIds: [...new Set(t.classes.map((c) => c.classId))],
    sectionIds: [...new Set(t.classes.map((c) => c.sectionId))],
  };
};

/** Student ids a STUDENT/PARENT may see; null for every other role. */
export const getOwnStudentIds = async (user: AuthUser): Promise<string[] | null> => {
  if (user.role === 'STUDENT') {
    const s = await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    return s ? [s.id] : [];
  }
  if (user.role === 'PARENT') {
    const p = await prisma.parent.findUnique({ where: { userId: user.id }, include: { children: { select: { id: true } } } });
    return p ? p.children.map((c) => c.id) : [];
  }
  return null;
};

/** Classes/sections the user belongs to (student/parent/teacher); null for admin-like roles. */
export const getMemberScope = async (user: AuthUser): Promise<{ classIds: string[]; sectionIds: string[] } | null> => {
  const ids = await getOwnStudentIds(user);
  if (ids) {
    const students = await prisma.student.findMany({ where: { id: { in: ids } }, select: { classId: true, sectionId: true } });
    return {
      classIds: students.map((s) => s.classId).filter((x): x is string => !!x),
      sectionIds: students.map((s) => s.sectionId).filter((x): x is string => !!x),
    };
  }
  if (user.role === 'TEACHER') {
    const t = await getTeacherContext(user.id);
    return { classIds: t?.classIds ?? [], sectionIds: t?.sectionIds ?? [] };
  }
  return null;
};
