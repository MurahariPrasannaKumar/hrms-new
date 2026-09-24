import type { Request } from 'express';
import type { AttendanceStatus, Prisma } from '@prisma/client';
import { optionalSchoolScope, resolveSchoolId } from '../../middlewares/tenant';
import { ApiError } from '../../utils/ApiError';
import { getOwnStudentIds, getTeacherContext } from '../../utils/actor';
import { audit } from '../../utils/audit';
import { pageArgs, pageMeta, type PaginationQuery } from '../../utils/pagination';
import { notificationService } from '../notifications/notification.service';
import { attendanceRepository as repo } from './attendance.repository';

const percentage = (counts: Record<string, number>) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return total ? Math.round(((counts.PRESENT + counts.LATE) / total) * 1000) / 10 : 0;
};
const zeroCounts = () => ({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });

/** TEACHER may only touch sections they are assigned to. */
const assertSectionAccess = async (req: Request, sectionId: string) => {
  if (req.user!.role !== 'TEACHER') return;
  const ctx = await getTeacherContext(req.user!.id);
  if (!ctx?.sectionIds.includes(sectionId)) throw ApiError.forbidden('You are not assigned to this section');
};

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
};

export const attendanceService = {
  async mark(req: Request, body: { schoolId?: string; sectionId: string; date: Date; records: { studentId: string; status: AttendanceStatus; remark?: string }[] }) {
    const schoolId = resolveSchoolId(req, body.schoolId);
    const section = await repo.findSection(body.sectionId, schoolId);
    if (!section) throw ApiError.notFound('Section not found');
    await assertSectionAccess(req, section.id);

    const ids = [...new Set(body.records.map((r) => r.studentId))];
    const students = await repo.studentsInSection(section.id, schoolId, ids);
    if (students.length !== ids.length) throw ApiError.badRequest('Some students do not belong to this section');

    const records = [...new Map(body.records.map((r) => [r.studentId, r])).values()];
    const attendance = await repo.markBulk({ schoolId, sectionId: section.id, date: body.date, markedById: req.user!.id }, records);

    const absent = new Set(records.filter((r) => r.status === 'ABSENT').map((r) => r.studentId));
    const recipients = students.filter((s) => absent.has(s.id)).flatMap((s) => [s.userId, s.parent?.userId]).filter((x): x is string => !!x);
    await notificationService.notify(recipients, {
      type: 'ATTENDANCE',
      title: 'Marked absent',
      message: `Absence recorded for ${body.date.toISOString().slice(0, 10)} (${section.class.name} - ${section.name}).`,
    });

    await audit(req, { schoolId, action: 'MARK', resource: 'ATTENDANCE', resourceId: attendance.id, metadata: { sectionId: section.id, date: body.date.toISOString(), count: records.length } });
    return { id: attendance.id, sectionId: section.id, date: body.date, marked: records.length };
  },

  async list(req: Request, q: PaginationQuery & { schoolId?: string; sectionId?: string; classId?: string; studentId?: string; status?: AttendanceStatus; date?: Date; from?: Date; to?: Date }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const where: Prisma.AttendanceRecordWhereInput = { ...(schoolId ? { schoolId } : {}) };
    if (q.studentId) where.studentId = q.studentId;
    if (q.status) where.status = q.status;
    const att: Prisma.AttendanceWhereInput = {};
    if (q.sectionId) att.sectionId = q.sectionId;
    if (q.classId) att.section = { classId: q.classId };
    if (q.date) att.date = q.date;
    else if (q.from || q.to) att.date = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };

    const own = await getOwnStudentIds(req.user!);
    if (own) {
      if (q.studentId && !own.includes(q.studentId)) throw ApiError.forbidden();
      where.studentId = q.studentId ?? { in: own };
    }
    if (req.user!.role === 'TEACHER') {
      const ctx = await getTeacherContext(req.user!.id);
      const allowed = ctx?.sectionIds ?? [];
      if (q.sectionId && !allowed.includes(q.sectionId)) throw ApiError.forbidden('You are not assigned to this section');
      if (!q.sectionId) att.sectionId = { in: allowed };
    }
    if (Object.keys(att).length) where.attendance = att;

    const { skip, take } = pageArgs(q);
    const [items, total] = await repo.listRecords(where, skip, take);
    return { items, meta: pageMeta(q, total) };
  },

  async roster(req: Request, q: { schoolId?: string; sectionId: string; date: Date }) {
    const schoolId = resolveSchoolId(req, q.schoolId);
    const section = await repo.findSection(q.sectionId, schoolId);
    if (!section) throw ApiError.notFound('Section not found');
    await assertSectionAccess(req, section.id);
    const [students, existing] = await Promise.all([
      repo.studentsInSection(section.id, schoolId),
      repo.recordsForDate(section.id, q.date, schoolId),
    ]);
    const byStudent = new Map(existing.map((r) => [r.studentId, r]));
    return {
      sectionId: section.id,
      date: q.date,
      students: students.map((s) => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName, admissionNumber: s.admissionNumber,
        status: byStudent.get(s.id)?.status ?? null, remark: byStudent.get(s.id)?.remark ?? null,
      })),
    };
  },

  async summary(req: Request, q: { schoolId?: string; studentId?: string; sectionId?: string; month?: string }) {
    const schoolId = optionalSchoolScope(req, q.schoolId);
    const where: Prisma.AttendanceRecordWhereInput = { ...(schoolId ? { schoolId } : {}) };
    const own = await getOwnStudentIds(req.user!);
    if (own) {
      if (q.studentId && !own.includes(q.studentId)) throw ApiError.forbidden();
      where.studentId = q.studentId ?? { in: own };
    } else if (q.studentId) where.studentId = q.studentId;

    const att: Prisma.AttendanceWhereInput = {};
    if (q.sectionId) {
      await assertSectionAccess(req, q.sectionId);
      att.sectionId = q.sectionId;
    } else if (req.user!.role === 'TEACHER') {
      att.sectionId = { in: (await getTeacherContext(req.user!.id))?.sectionIds ?? [] };
    }
    if (q.month) att.date = monthRange(q.month);
    if (Object.keys(att).length) where.attendance = att;

    const counts = zeroCounts();
    for (const g of await repo.groupByStatus(where)) counts[g.status] = g._count._all;
    return { month: q.month ?? null, counts, total: Object.values(counts).reduce((a, b) => a + b, 0), percentage: percentage(counts) };
  },

  async updateRecord(req: Request, id: string, data: { status?: AttendanceStatus; remark?: string | null }) {
    const record = await repo.findRecord(id);
    const schoolId = req.user!.role === 'SUPER_ADMIN' ? record?.schoolId : req.user!.schoolId;
    if (!record || record.schoolId !== schoolId) throw ApiError.notFound('Attendance record not found');
    await assertSectionAccess(req, record.attendance.sectionId);
    const updated = await repo.updateRecord(id, data);
    if (data.status === 'ABSENT' && record.status !== 'ABSENT') {
      await notificationService.notify(
        [record.student.userId, record.student.parent?.userId].filter((x): x is string => !!x),
        { type: 'ATTENDANCE', title: 'Marked absent', message: `Absence recorded for ${record.attendance.date.toISOString().slice(0, 10)}.` },
      );
    }
    await audit(req, { schoolId: record.schoolId, action: 'UPDATE', resource: 'ATTENDANCE_RECORD', resourceId: id, metadata: { from: record.status, ...data } });
    return updated;
  },
};
