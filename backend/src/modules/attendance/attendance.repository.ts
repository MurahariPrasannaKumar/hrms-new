import type { AttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export const attendanceRepository = {
  findSection: (id: string, schoolId?: string) =>
    prisma.section.findFirst({ where: { id, ...(schoolId ? { schoolId } : {}) }, include: { class: { select: { name: true } } } }),

  studentsInSection: (sectionId: string, schoolId: string, ids?: string[]) =>
    prisma.student.findMany({
      where: { sectionId, schoolId, status: 'ACTIVE', ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, firstName: true, lastName: true, admissionNumber: true, userId: true, parent: { select: { userId: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),

  markBulk: (
    p: { schoolId: string; sectionId: string; date: Date; markedById: string },
    records: { studentId: string; status: AttendanceStatus; remark?: string }[],
  ) =>
    prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.upsert({
        where: { sectionId_date: { sectionId: p.sectionId, date: p.date } },
        update: { markedById: p.markedById },
        create: p,
      });
      for (const r of records) {
        await tx.attendanceRecord.upsert({
          where: { attendanceId_studentId: { attendanceId: attendance.id, studentId: r.studentId } },
          update: { status: r.status, remark: r.remark ?? null, source: 'TEACHER', checkedInAt: null },
          create: { attendanceId: attendance.id, schoolId: p.schoolId, studentId: r.studentId, status: r.status, remark: r.remark },
        });
      }
      return attendance;
    }),

  listRecords: (where: Prisma.AttendanceRecordWhereInput, skip: number, take: number) =>
    prisma.$transaction([
      prisma.attendanceRecord.findMany({
        where, skip, take,
        orderBy: [{ attendance: { date: 'desc' } }, { student: { firstName: 'asc' } }],
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          attendance: { select: { id: true, date: true, sectionId: true } },
        },
      }),
      prisma.attendanceRecord.count({ where }),
    ]),

  recordsForDate: (sectionId: string, date: Date, schoolId: string) =>
    prisma.attendanceRecord.findMany({
      where: { schoolId, attendance: { sectionId, date } },
      select: { studentId: true, status: true, remark: true },
    }),

  groupByStatus: (where: Prisma.AttendanceRecordWhereInput) =>
    prisma.attendanceRecord.groupBy({ by: ['status'], where, _count: { _all: true } }),

  findRecord: (id: string) =>
    prisma.attendanceRecord.findUnique({ where: { id }, include: { attendance: { select: { sectionId: true, date: true } }, student: { select: { userId: true, parent: { select: { userId: true } } } } } }),

  updateRecord: (id: string, data: Prisma.AttendanceRecordUpdateInput) => prisma.attendanceRecord.update({ where: { id }, data }),
};
