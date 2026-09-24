import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

const diaryInclude = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.DiaryEntryInclude;

const assignmentInclude = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  teacher: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  _count: { select: { submissions: true } },
} satisfies Prisma.AssignmentInclude;

export const diaryRepository = {
  listDiary: (where: Prisma.DiaryEntryWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.diaryEntry.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: diaryInclude }),
      prisma.diaryEntry.count({ where }),
    ]),
  findDiary: (id: string, where: Prisma.DiaryEntryWhereInput = {}) => prisma.diaryEntry.findFirst({ where: { id, ...where }, include: diaryInclude }),
  createDiary: (data: Prisma.DiaryEntryUncheckedCreateInput) => prisma.diaryEntry.create({ data, include: diaryInclude }),
  updateDiary: (id: string, data: Prisma.DiaryEntryUncheckedUpdateInput) => prisma.diaryEntry.update({ where: { id }, data, include: diaryInclude }),
  deleteDiary: (id: string) => prisma.diaryEntry.delete({ where: { id } }),

  listAssignments: (where: Prisma.AssignmentWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.assignment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: assignmentInclude }),
      prisma.assignment.count({ where }),
    ]),
  findAssignment: (id: string, where: Prisma.AssignmentWhereInput = {}) => prisma.assignment.findFirst({ where: { id, ...where }, include: assignmentInclude }),
  createAssignment: (data: Prisma.AssignmentUncheckedCreateInput) => prisma.assignment.create({ data, include: assignmentInclude }),
  updateAssignment: (id: string, data: Prisma.AssignmentUncheckedUpdateInput) => prisma.assignment.update({ where: { id }, data, include: assignmentInclude }),
  deleteAssignment: (id: string) => prisma.assignment.delete({ where: { id } }),

  submissions: (assignmentId: string, studentIds?: string[]) =>
    prisma.assignmentSubmission.findMany({
      where: { assignmentId, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
      include: { student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { submittedAt: 'desc' },
    }),
  upsertSubmission: (assignmentId: string, studentId: string, schoolId: string, data: { content?: string; fileId?: string }) =>
    prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: { ...data, submittedAt: new Date() },
      create: { assignmentId, studentId, schoolId, ...data },
    }),
  findSubmission: (id: string, assignmentId: string, schoolId: string) =>
    prisma.assignmentSubmission.findFirst({ where: { id, assignmentId, schoolId } }),
  gradeSubmission: (id: string, marks: number) => prisma.assignmentSubmission.update({ where: { id }, data: { marks } }),

  classTeacherPairs: (teacherId: string) => prisma.teacherClass.findMany({ where: { teacherId } }),
  findClass: (id: string, schoolId: string) => prisma.class.findFirst({ where: { id, schoolId } }),
  findSection: (id: string, classId: string, schoolId: string) => prisma.section.findFirst({ where: { id, classId, schoolId } }),
  findSubject: (id: string, schoolId: string) => prisma.subject.findFirst({ where: { id, schoolId } }),
  findFile: (id: string, schoolId: string) => prisma.file.findFirst({ where: { id, schoolId }, select: { id: true } }),
  findTeacher: (id: string, schoolId: string) => prisma.teacher.findFirst({ where: { id, schoolId } }),
  studentUsersInClass: (classId: string, schoolId: string, sectionId?: string) =>
    prisma.student.findMany({ where: { classId, schoolId, ...(sectionId ? { sectionId } : {}) }, select: { userId: true, parent: { select: { userId: true } } } }),
};
