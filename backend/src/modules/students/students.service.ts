import { defaultSectionId } from '../academics/default-section';
import { classNotifier } from '../academics/class-notifier';
import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { orderBy, pageArgs, pageMeta } from '../../utils/pagination';
import type { AuthUser } from '../../types/express';
import { studentsRepository as repo } from './students.repository';
import type { CreateStudentInput, ListStudentsQuery, UpdateStudentInput } from './students.validation';

/** Role-based visibility on top of the tenant filter. */
const accessFilter = async (user: AuthUser): Promise<Prisma.StudentWhereInput> => {
  switch (user.role) {
    case 'TEACHER': {
      const t = await repo.teacherAssignments(user.id);
      // Own classes, plus students not yet placed in any class so a teacher can enrol them.
      return { OR: [...(t?.classes ?? []).map((c) => ({ classId: c.classId, sectionId: c.sectionId })), { classId: null }] };
    }
    case 'PARENT': return { parent: { userId: user.id } };
    case 'STUDENT': return { userId: user.id };
    default: return {};
  }
};

/** Ensure class / section / parent belong to the given school and are consistent. */
const assertRefs = async (schoolId: string, r: { classId?: string | null; sectionId?: string | null; parentId?: string | null }) => {
  if (r.classId && !(await prisma.class.findFirst({ where: { id: r.classId, schoolId }, select: { id: true } }))) {
    throw ApiError.badRequest('Class not found in this school');
  }
  if (r.sectionId) {
    const s = await prisma.section.findFirst({ where: { id: r.sectionId, schoolId }, select: { classId: true } });
    if (!s) throw ApiError.badRequest('Section not found in this school');
    if (r.classId && s.classId !== r.classId) throw ApiError.badRequest('Section does not belong to the class');
  }
  if (r.parentId && !(await prisma.parent.findFirst({ where: { id: r.parentId, schoolId }, select: { id: true } }))) {
    throw ApiError.badRequest('Parent not found in this school');
  }
};

export const studentsService = {
  async list(user: AuthUser, tenant: { schoolId?: string }, q: ListStudentsQuery) {
    const where: Prisma.StudentWhereInput = {
      AND: [
        tenant,
        await accessFilter(user),
        { classId: q.classId, sectionId: q.sectionId, status: q.status },
        q.search
          ? { OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
              { admissionNumber: { contains: q.search, mode: 'insensitive' } },
            ] }
          : {},
      ],
    };
    const [items, total] = await repo.list(where, orderBy(q, ['firstName', 'lastName', 'admissionNumber', 'createdAt', 'status']), pageArgs(q).skip, pageArgs(q).take);
    return { items, meta: pageMeta(q, total) };
  },

  async get(user: AuthUser, tenant: { schoolId?: string }, id: string) {
    const student = await repo.findProfile({ AND: [{ id }, tenant, await accessFilter(user)] });
    if (!student) throw ApiError.notFound('Student not found');
    const [groups, recent, results, assignments] = await Promise.all([
      repo.attendanceSummary(id),
      repo.recentAttendance(id),
      repo.results(id),
      student.classId ? repo.assignments(student.classId, id) : Promise.resolve([]),
    ]);
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const g of groups) counts[g.status] = g._count._all;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const percentage = total ? Math.round(((counts.PRESENT + counts.LATE) / total) * 1000) / 10 : null;
    return { ...student, attendance: { ...counts, total, percentage, recent }, results, assignments };
  },

  async me(user: AuthUser) {
    if (user.role !== 'STUDENT') throw ApiError.forbidden('Only students have a self profile');
    const own = await prisma.student.findFirst({ where: { userId: user.id }, select: { id: true, schoolId: true } });
    if (!own) throw ApiError.notFound('Student profile not found');
    return studentsService.get(user, { schoolId: own.schoolId }, own.id);
  },

  async create(schoolId: string, input: CreateStudentInput) {
    const { login, schoolId: _ignored, ...data } = input;
    await assertRefs(schoolId, data);
    const created = await prisma.$transaction(async (tx) => {
      let userId: string | undefined;
      if (login) {
        const role = await repo.studentRoleId();
        const u = await tx.user.create({
          data: {
            schoolId, roleId: role.id, email: login.email, passwordHash: await argon2.hash(login.password),
            firstName: data.firstName, lastName: data.lastName, mustChangePassword: true,
          },
        });
        userId = u.id;
      }
      return tx.student.create({ data: { ...data, schoolId, userId } });
    });
    let placed = created;
    if (created.classId && !created.sectionId) {
      placed = await prisma.student.update({ where: { id: created.id }, data: { sectionId: await defaultSectionId(created.classId, created.schoolId) } });
    }
    if (placed.classId) classNotifier.studentAssigned(placed.id);
    return placed;
  },

  async update(user: AuthUser, tenant: { schoolId?: string }, id: string, input: UpdateStudentInput) {
    const existing = await repo.findScoped({ AND: [{ id }, tenant, await accessFilter(user)] });
    if (!existing) throw ApiError.notFound('Student not found');
    if (user.role === 'TEACHER' && input.classId) {
      const teaches = await prisma.teacherClass.findFirst({ where: { classId: input.classId, teacher: { userId: user.id } } });
      if (!teaches) throw ApiError.forbidden('You can only enrol students into classes you teach. Select the class under "Classes I teach" in your profile first.');
    }
    await assertRefs(existing.schoolId, {
      classId: input.classId ?? (input.sectionId ? existing.classId : undefined),
      sectionId: input.sectionId, parentId: input.parentId,
    });
    let updated = await prisma.student.update({ where: { id }, data: input });
    if (updated.classId && !updated.sectionId) {
      updated = await prisma.student.update({ where: { id }, data: { sectionId: await defaultSectionId(updated.classId, updated.schoolId) } });
    }
    if (updated.classId && (updated.classId !== existing.classId || updated.sectionId !== existing.sectionId)) classNotifier.studentAssigned(id);
    return updated;
  },

  async remove(tenant: { schoolId?: string }, id: string) {
    const existing = await repo.findScoped({ AND: [{ id }, tenant] });
    if (!existing) throw ApiError.notFound('Student not found');
    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id } });
      if (existing.userId) await tx.user.delete({ where: { id: existing.userId } });
    });
    return existing;
  },
};
