import type { z } from 'zod';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { ApiError } from '../../utils/ApiError';
import { teachersService } from '../teachers/teachers.service';
import type { teachingClassesSchema, updateProfileSchema } from './profile.validation';

type Update = z.infer<typeof updateProfileSchema>;

const userSelect = {
  id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true, status: true, lastLoginAt: true, createdAt: true,
  role: { select: { name: true } }, school: { select: { id: true, name: true } },
} as const;

export const profileService = {
  async get(actor: AuthUser) {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: userSelect });
    if (!user) throw ApiError.notFound('User not found');
    const role = user.role.name;
    let student = null;
    let teacher = null;
    if (role === 'STUDENT') {
      student = await prisma.student.findUnique({
        where: { userId: actor.id },
        select: {
          admissionNumber: true, dateOfBirth: true, gender: true, address: true, admissionDate: true, status: true,
          class: { select: { id: true, name: true, level: true, academicYear: { select: { name: true } } } },
          section: { select: { id: true, name: true } },
          parent: { select: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        },
      });
    } else if (role === 'TEACHER') {
      const t = await prisma.teacher.findUnique({
        where: { userId: actor.id },
        select: { employeeId: true, qualification: true, joiningDate: true, subjects: { select: { subject: { select: { id: true, name: true } } } } },
      });
      if (t) teacher = { ...t, subjects: t.subjects.map((x) => x.subject), classes: await teachersService.myClasses(actor.id) };
    }
    return { user: { ...user, role }, student, teacher };
  },

  async update(actor: AuthUser, d: Update) {
    const role = actor.role;
    await prisma.$transaction(async (tx) => {
      const { firstName, lastName, phone } = d;
      await tx.user.update({ where: { id: actor.id }, data: { firstName, lastName, phone } });
      if (role === 'STUDENT') {
        const { address, gender, dateOfBirth } = d;
        await tx.student.updateMany({
          where: { userId: actor.id },
          data: { address, gender, dateOfBirth, ...(firstName && { firstName }), ...(lastName && { lastName }), ...(phone !== undefined && { phone }) },
        });
      } else if (role === 'TEACHER') {
        await tx.teacher.updateMany({ where: { userId: actor.id }, data: { qualification: d.qualification, ...(phone !== undefined && { phone }) } });
      }
    });
    return this.get(actor);
  },

  /** A teacher chooses the classes they teach. Every section of a chosen class is assigned (a default section "A" is created if none exists). */
  async setTeachingClasses(actor: AuthUser, { classIds }: z.infer<typeof teachingClassesSchema>) {
    if (actor.role !== 'TEACHER') throw ApiError.forbidden('Only teachers can choose the classes they teach');
    const teacher = await prisma.teacher.findUnique({ where: { userId: actor.id }, select: { id: true, schoolId: true } });
    if (!teacher) throw ApiError.notFound('Teacher profile not found');
    const ids = [...new Set(classIds)];
    const classes = await prisma.class.findMany({ where: { id: { in: ids }, schoolId: teacher.schoolId }, select: { id: true, sections: { select: { id: true } } } });
    if (classes.length !== ids.length) throw ApiError.badRequest('One or more classes were not found in your school');

    const pairs: { teacherId: string; classId: string; sectionId: string }[] = [];
    await prisma.$transaction(async (tx) => {
      for (const c of classes) {
        const sectionIds = c.sections.map((s) => s.id);
        if (!sectionIds.length) sectionIds.push((await tx.section.create({ data: { classId: c.id, schoolId: teacher.schoolId, name: 'A' } })).id);
        sectionIds.forEach((sectionId) => pairs.push({ teacherId: teacher.id, classId: c.id, sectionId }));
      }
      await tx.teacherClass.deleteMany({ where: { teacherId: teacher.id } });
      await tx.teacherClass.createMany({ data: pairs });
    });
    return teachersService.myClasses(actor.id);
  },
};
