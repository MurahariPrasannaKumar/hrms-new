import argon2 from 'argon2';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { orderBy, pageArgs, pageMeta } from '../../utils/pagination';
import { classNotifier } from '../academics/class-notifier';
import { defaultSectionId } from '../academics/default-section';
import { usersRepository as repo } from './users.repository';
import type { createUserSchema, listUsersSchema, updateUserSchema } from './users.validation';

const SORTABLE = ['firstName', 'lastName', 'email', 'status', 'lastLoginAt', 'createdAt'];
type Create = z.infer<typeof createUserSchema>;
type Update = z.infer<typeof updateUserSchema>;

/** Load a user the actor is allowed to touch, or 404 (never leak cross-tenant existence). */
const getManaged = async (actor: AuthUser, id: string) => {
  const user = await repo.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (actor.role !== 'SUPER_ADMIN') {
    if (user.schoolId !== actor.schoolId || user.role.name === 'SUPER_ADMIN') throw ApiError.notFound('User not found');
  }
  return user;
};

const assertRoleAllowed = (actor: AuthUser, role: string) => {
  if (actor.role !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') throw ApiError.forbidden('Cannot assign the SUPER_ADMIN role');
};

/** Place a STUDENT user's profile in a class/section (validated against the school), and tell the student. */
const placeStudent = async (userId: string, schoolId: string | null, classId: string | null | undefined, sectionId: string | null | undefined) => {
  if (classId === undefined && sectionId === undefined) return;
  if (!schoolId) throw ApiError.badRequest('A school is required to assign a class');
  if (classId && !(await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } }))) throw ApiError.badRequest('Class not found in this school');
  if (sectionId) {
    const s = await prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { classId: true } });
    if (!s) throw ApiError.badRequest('Section not found in this school');
    if (classId && s.classId !== classId) throw ApiError.badRequest('Section does not belong to the class');
  }
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true, classId: true, sectionId: true } });
  if (!student) return;
  const nextClass = classId === undefined ? student.classId : classId;
  const nextSection = classId === null ? null : sectionId === undefined ? (classId && classId !== student.classId ? null : student.sectionId) : sectionId;
  const finalSection = nextClass && !nextSection ? await defaultSectionId(nextClass, schoolId) : nextSection;
  await prisma.student.update({ where: { id: student.id }, data: { classId: nextClass, sectionId: finalSection } });
  if (nextClass && (nextClass !== student.classId || finalSection !== student.sectionId)) classNotifier.studentAssigned(student.id);
};

export const usersService = {
  async list(actor: AuthUser, q: z.infer<typeof listUsersSchema>) {
    const schoolId = actor.role === 'SUPER_ADMIN' ? q.schoolId : actor.schoolId!;
    const where: Prisma.UserWhereInput = {
      ...(schoolId && { schoolId }),
      ...(actor.role !== 'SUPER_ADMIN' && { role: { name: { not: 'SUPER_ADMIN' } } }),
      ...(q.role && { role: { name: q.role } }),
      ...(q.status && { status: q.status }),
      ...(q.search && {
        OR: [
          { firstName: { contains: q.search, mode: 'insensitive' } },
          { lastName: { contains: q.search, mode: 'insensitive' } },
          { email: { contains: q.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await repo.list(where, orderBy(q, SORTABLE), pageArgs(q).skip, pageArgs(q).take);
    return { items, meta: pageMeta(q, total) };
  },

  get: (actor: AuthUser, id: string) => getManaged(actor, id),

  async create(actor: AuthUser, data: Create) {
    assertRoleAllowed(actor, data.role);
    let schoolId: string | null;
    if (data.role === 'SUPER_ADMIN') schoolId = null;
    else if (actor.role === 'SUPER_ADMIN') {
      if (!data.schoolId) throw ApiError.badRequest('schoolId is required for school users');
      if (!(await prisma.school.findUnique({ where: { id: data.schoolId } }))) throw ApiError.badRequest('School does not exist');
      schoolId = data.schoolId;
    } else schoolId = actor.schoolId;

    const role = await repo.findRole(data.role);
    if (!role) throw ApiError.badRequest('Unknown role');
    const created = await repo.create(
      {
        email: data.email, username: data.username, firstName: data.firstName, lastName: data.lastName,
        phone: data.phone, status: data.status, roleId: role.id, schoolId,
        passwordHash: await argon2.hash(data.password),
      },
      data.role,
    );
    if (data.role === 'STUDENT') await placeStudent(created.id, schoolId, data.classId, data.sectionId);
    return created;
  },

  async update(actor: AuthUser, id: string, data: Update) {
    const existing = await getManaged(actor, id);
    const { role, schoolId, extraPermissions, classId, sectionId, ...rest } = data;
    const patch: Prisma.UserUncheckedUpdateInput = { ...rest };

    if (id === actor.id && (data.status && data.status !== 'ACTIVE')) throw ApiError.badRequest('You cannot deactivate your own account');
    if (role) {
      assertRoleAllowed(actor, role);
      const r = await repo.findRole(role);
      if (!r) throw ApiError.badRequest('Unknown role');
      patch.roleId = r.id;
      if (role === 'SUPER_ADMIN') patch.schoolId = null;
    }
    if (schoolId !== undefined && actor.role === 'SUPER_ADMIN' && (role ?? existing.role.name) !== 'SUPER_ADMIN') {
      if (schoolId && !(await prisma.school.findUnique({ where: { id: schoolId } }))) throw ApiError.badRequest('School does not exist');
      patch.schoolId = schoolId;
    }
    const updated = await repo.update(id, patch);
    if (role || patch.schoolId !== undefined) await repo.ensureProfile(updated, role ?? existing.role.name);
    if ((role ?? existing.role.name) === 'STUDENT') await placeStudent(id, updated.schoolId, classId, sectionId);
    if (extraPermissions) await repo.setExtraPermissions(id, extraPermissions);
    if (data.status && data.status !== 'ACTIVE') await repo.revokeSessions(id);
    return updated;
  },

  async deactivate(actor: AuthUser, id: string) {
    if (id === actor.id) throw ApiError.badRequest('You cannot deactivate your own account');
    await getManaged(actor, id);
    const user = await repo.update(id, { status: 'INACTIVE' });
    await repo.revokeSessions(id);
    return user;
  },

  /** Permanently removes the login so the email can be reused. Sessions, tokens and permissions cascade. */
  async remove(actor: AuthUser, id: string) {
    if (id === actor.id) throw ApiError.badRequest('You cannot delete your own account');
    const user = await getManaged(actor, id);
    try {
      await prisma.user.delete({ where: { id } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2003') {
        throw ApiError.conflict('This user has linked records and cannot be deleted. Deactivate the user instead.');
      }
      throw e;
    }
    return user;
  },

  /** Only admins set passwords: users cannot change their own. Signs the user out everywhere. */
  async setPassword(actor: AuthUser, id: string, password: string) {
    await getManaged(actor, id);
    await repo.setPassword(id, await argon2.hash(password));
  },
};
