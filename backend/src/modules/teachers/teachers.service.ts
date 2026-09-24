import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { orderBy, pageArgs, pageMeta } from '../../utils/pagination';
import { teachersRepository as repo } from './teachers.repository';
import type { CreateTeacherInput, ListTeachersQuery, UpdateTeacherInput } from './teachers.validation';

type Tenant = { schoolId?: string };

const getScoped = async (tenant: Tenant, id: string) => {
  const t = await repo.findScoped({ AND: [{ id }, tenant] });
  if (!t) throw ApiError.notFound('Teacher not found');
  return t;
};

export const teachersService = {
  /** Classes/sections the signed-in teacher is assigned to (drives attendance & diary pickers). */
  async myClasses(userId: string) {
    const rows = await prisma.teacherClass.findMany({
      where: { teacher: { userId } },
      include: { class: { select: { id: true, name: true, level: true } }, section: { select: { id: true, name: true } } },
      orderBy: [{ class: { level: 'asc' } }, { section: { name: 'asc' } }],
    });
    const byClass = new Map<string, { id: string; name: string; level: number | null; sections: { id: string; name: string }[] }>();
    for (const r of rows) {
      const entry = byClass.get(r.classId) ?? { ...r.class, sections: [] };
      entry.sections.push(r.section);
      byClass.set(r.classId, entry);
    }
    return [...byClass.values()];
  },

  async list(tenant: Tenant, q: ListTeachersQuery) {
    const where: Prisma.TeacherWhereInput = {
      AND: [
        tenant,
        q.search
          ? { OR: [
              { employeeId: { contains: q.search, mode: 'insensitive' } },
              { user: { firstName: { contains: q.search, mode: 'insensitive' } } },
              { user: { lastName: { contains: q.search, mode: 'insensitive' } } },
              { user: { email: { contains: q.search, mode: 'insensitive' } } },
            ] }
          : {},
      ],
    };
    const sort = q.sortBy === 'firstName' || q.sortBy === 'lastName'
      ? { user: { [q.sortBy]: q.sortOrder } }
      : orderBy(q, ['employeeId', 'createdAt']);
    const [items, total] = await repo.list(where, sort, pageArgs(q).skip, pageArgs(q).take);
    return { items, meta: pageMeta(q, total) };
  },

  async get(tenant: Tenant, id: string) {
    const t = await repo.findDetail({ AND: [{ id }, tenant] });
    if (!t) throw ApiError.notFound('Teacher not found');
    const students = await repo.countStudents(t.classes.map((c) => ({ classId: c.classId, sectionId: c.sectionId })));
    return {
      ...t,
      workload: { subjects: t.subjects.length, sections: t.classes.length, students, assignments: t._count.assignments, diaryEntries: t._count.diaryEntries },
    };
  },

  async create(schoolId: string, input: CreateTeacherInput) {
    const role = await repo.teacherRoleId();
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          schoolId, roleId: role.id, email: input.email, passwordHash: await argon2.hash(input.password),
          firstName: input.firstName, lastName: input.lastName, phone: input.phone, mustChangePassword: true,
        },
      });
      return tx.teacher.create({
        data: { schoolId, userId: user.id, employeeId: input.employeeId, phone: input.phone, qualification: input.qualification, joiningDate: input.joiningDate },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
      });
    });
  },

  async update(tenant: Tenant, id: string, input: UpdateTeacherInput) {
    const t = await getScoped(tenant, id);
    const { firstName, lastName, status, phone, ...teacherFields } = input;
    return prisma.$transaction(async (tx) => {
      if (firstName || lastName || status || phone) {
        await tx.user.update({ where: { id: t.userId }, data: { firstName, lastName, status, phone } });
      }
      return tx.teacher.update({
        where: { id },
        data: { ...teacherFields, phone },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, status: true } } },
      });
    });
  },

  async remove(tenant: Tenant, id: string) {
    const t = await getScoped(tenant, id);
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: t.userId }, data: { status: 'INACTIVE' } }),
      prisma.refreshToken.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: now } }),
      prisma.session.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
    return t;
  },

  async setSubjects(tenant: Tenant, id: string, subjectIds: string[]) {
    const t = await getScoped(tenant, id);
    const unique = [...new Set(subjectIds)];
    const found = await prisma.subject.count({ where: { id: { in: unique }, schoolId: t.schoolId } });
    if (found !== unique.length) throw ApiError.badRequest('One or more subjects were not found in this school');
    await prisma.$transaction([
      prisma.teacherSubject.deleteMany({ where: { teacherId: id } }),
      prisma.teacherSubject.createMany({ data: unique.map((subjectId) => ({ teacherId: id, subjectId })) }),
    ]);
    return { teacher: t, subjectIds: unique };
  },

  async setClasses(tenant: Tenant, id: string, assignments: { classId: string; sectionId: string }[]) {
    const t = await getScoped(tenant, id);
    const unique = [...new Map(assignments.map((a) => [`${a.classId}:${a.sectionId}`, a])).values()];
    const sections = await prisma.section.findMany({
      where: { id: { in: unique.map((a) => a.sectionId) }, schoolId: t.schoolId },
      select: { id: true, classId: true },
    });
    const byId = new Map(sections.map((s) => [s.id, s.classId]));
    if (unique.some((a) => byId.get(a.sectionId) !== a.classId)) {
      throw ApiError.badRequest('One or more class/section pairs were not found in this school');
    }
    await prisma.$transaction([
      prisma.teacherClass.deleteMany({ where: { teacherId: id } }),
      prisma.teacherClass.createMany({ data: unique.map((a) => ({ teacherId: id, ...a })) }),
    ]);
    return { teacher: t, assignments: unique };
  },
};
