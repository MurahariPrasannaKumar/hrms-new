import type { Request } from 'express';
import { prisma } from '../../config/database';
import { ApiError } from '../../utils/ApiError';
import { audit } from '../../utils/audit';
import { toUtcDate } from '../../utils/actor';
import { defaultSectionId } from '../academics/default-section';
import { usageService } from '../usage/usage.service';
import {
  buildOverview, localDateString, localTimeString, schoolTimezone, weekdaysBetween, type DayRow, type Status,
} from './attendance-stats';

const NOT_ELIGIBLE = 'Attendance is unavailable because your student profile has no class assigned. Please ask your school administrator to assign one.';

/** A student must have been active on the platform this long today before they can mark themselves present. */
export const MIN_ACTIVE_SECONDS = 5 * 60;

/** A student placed in a class but no section gets the class's default section, so attendance can work. */
const withSection = async <T extends { id: string; schoolId: string; classId: string | null; sectionId: string | null }>(s: T | null): Promise<T | null> => {
  if (!s || !s.classId || s.sectionId) return s;
  const sectionId = await defaultSectionId(s.classId, s.schoolId);
  await prisma.student.update({ where: { id: s.id }, data: { sectionId } });
  return { ...s, sectionId };
};

const studentWithContext = (where: { userId?: string; id?: string }) =>
  prisma.student.findFirst({
    where,
    select: {
      id: true, schoolId: true, firstName: true, lastName: true, status: true, classId: true, sectionId: true, userId: true,
      class: { select: { name: true } }, section: { select: { name: true } },
    },
  });

const unlockMessage = (active: number) => {
  const left = Math.ceil((MIN_ACTIVE_SECONDS - active) / 60);
  return `Attendance unlocks after ${MIN_ACTIVE_SECONDS / 60} minutes of active time on EduSphere today. About ${left} more minute${left === 1 ? '' : 's'} to go.`;
};

export const attendanceSelfService = {
  /** STUDENT marks themselves present for today (school timezone). Teachers can override afterwards. */
  async studentCheckIn(req: Request) {
    const student = await withSection(await studentWithContext({ userId: req.user!.id }));
    if (!student) throw ApiError.notFound('No student profile exists for this account. Please ask your school administrator to create one.');
    if (student.status !== 'ACTIVE') throw ApiError.forbidden('Only active students can mark attendance');
    if (!student.classId || !student.sectionId) throw ApiError.badRequest(NOT_ELIGIBLE);
    const active = (await usageService.today(req.user!.id, student.schoolId)).seconds;
    if (active < MIN_ACTIVE_SECONDS) throw ApiError.badRequest(unlockMessage(active));

    const tz = await schoolTimezone(student.schoolId);
    const today = toUtcDate(localDateString(tz));
    const now = new Date();

    const record = await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.upsert({
        where: { sectionId_date: { sectionId: student.sectionId!, date: today } },
        update: {},
        create: { schoolId: student.schoolId, sectionId: student.sectionId!, date: today, markedById: req.user!.id },
      });
      const existing = await tx.attendanceRecord.findUnique({
        where: { attendanceId_studentId: { attendanceId: attendance.id, studentId: student.id } },
      });
      if (existing) throw ApiError.conflict(`Attendance for today is already marked (${existing.status}).`);
      return tx.attendanceRecord.create({
        data: { attendanceId: attendance.id, schoolId: student.schoolId, studentId: student.id, status: 'PRESENT', source: 'SELF', checkedInAt: now },
      });
    });

    await audit(req, { schoolId: student.schoolId, action: 'CHECK_IN', resource: 'ATTENDANCE_RECORD', resourceId: record.id, metadata: { source: 'SELF' } });
    return { status: record.status, checkedInAt: record.checkedInAt, date: today };
  },

  /** Student (own) or parent (own child, ?studentId) attendance overview. */
  async studentOverview(req: Request, q: { month?: string; studentId?: string }) {
    const user = req.user!;
    let studentId: string;
    let children: { id: string; name: string }[] | undefined;
    if (user.role === 'PARENT') {
      const parent = await prisma.parent.findUnique({
        where: { userId: user.id },
        include: { children: { select: { id: true, firstName: true, lastName: true }, orderBy: { firstName: 'asc' } } },
      });
      children = (parent?.children ?? []).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` }));
      if (!children.length) throw ApiError.notFound('No children are linked to this account');
      studentId = q.studentId ?? children[0].id;
      if (!children.some((c) => c.id === studentId)) throw ApiError.forbidden('This student is not linked to your account');
    } else {
      const own = await withSection(await studentWithContext({ userId: user.id }));
      if (!own) throw ApiError.notFound('No student profile exists for this account. Please ask your school administrator to create one.');
      studentId = own.id;
    }

    const student = await studentWithContext({ id: studentId });
    if (!student) throw ApiError.notFound('Student not found');
    const tz = await schoolTimezone(student.schoolId);
    const todayStr = localDateString(tz);
    const month = q.month ?? todayStr.slice(0, 7);

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId },
      select: { status: true, checkedInAt: true, source: true, attendance: { select: { date: true } } },
    });
    const rows: DayRow[] = records.map((r) => ({ date: r.attendance.date, status: r.status as Status }));
    const todayRec = records.find((r) => r.attendance.date.toISOString().slice(0, 10) === todayStr);

    let canCheckIn = user.role === 'STUDENT' && !todayRec;
    let reason: string | null = null;
    let lockedBy: 'usage' | null = null;
    const activeSeconds = user.role === 'STUDENT' ? (await usageService.today(user.id, student.schoolId)).seconds : 0;
    if (user.role !== 'STUDENT') reason = 'Only the student can mark their own attendance.';
    else if (student.status !== 'ACTIVE') { canCheckIn = false; reason = 'Your student account is not active, so you cannot mark attendance.'; }
    else if (!student.classId || !student.sectionId) { canCheckIn = false; reason = NOT_ELIGIBLE; }
    else if (todayRec) reason = 'Already marked for today.';
    else if (user.role === 'STUDENT' && activeSeconds < MIN_ACTIVE_SECONDS) { canCheckIn = false; lockedBy = 'usage'; reason = unlockMessage(activeSeconds); }

    return {
      student: { id: student.id, name: `${student.firstName} ${student.lastName}`, class: student.class?.name ?? null, section: student.section?.name ?? null },
      ...(children ? { children } : {}),
      timezone: tz,
      today: {
        date: todayStr,
        marked: !!todayRec,
        status: todayRec?.status ?? null,
        source: todayRec?.source ?? null,
        checkedInAt: todayRec?.checkedInAt ?? null,
        checkedInTime: todayRec?.checkedInAt ? localTimeString(tz, todayRec.checkedInAt) : null,
        canCheckIn,
        reason,
        lockedBy,
        activeSeconds,
        requiredSeconds: MIN_ACTIVE_SECONDS,
      },
      ...buildOverview(rows, month, todayStr),
    };
  },

  async teacherCheckIn(req: Request) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.id }, select: { id: true, schoolId: true } });
    if (!teacher) throw ApiError.notFound('No teacher profile is linked to this account');
    const tz = await schoolTimezone(teacher.schoolId);
    const today = toUtcDate(localDateString(tz));
    const existing = await prisma.teacherAttendance.findUnique({ where: { teacherId_date: { teacherId: teacher.id, date: today } } });
    if (existing) throw ApiError.conflict('You have already checked in today.');
    const rec = await prisma.teacherAttendance.create({ data: { schoolId: teacher.schoolId, teacherId: teacher.id, date: today } });
    await audit(req, { schoolId: teacher.schoolId, action: 'CHECK_IN', resource: 'TEACHER_ATTENDANCE', resourceId: rec.id });
    return { status: rec.status, checkedInAt: rec.checkedInAt, date: today };
  },

  async teacherOverview(req: Request, q: { month?: string }) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user!.id }, select: { id: true, schoolId: true } });
    if (!teacher) throw ApiError.notFound('No teacher profile is linked to this account');
    return teacherOverviewById(teacher.id, teacher.schoolId, q.month);
  },
};

/**
 * Teachers only have rows for days they checked in, so working days (Mon-Fri) from their first
 * check-in up to yesterday (or today, once checked in) without a check-in count as ABSENT.
 */
export const teacherOverviewById = async (teacherId: string, schoolId: string, monthParam?: string) => {
  const tz = await schoolTimezone(schoolId);
  const todayStr = localDateString(tz);
  const month = monthParam ?? todayStr.slice(0, 7);
  const checkIns = await prisma.teacherAttendance.findMany({ where: { teacherId }, orderBy: { date: 'asc' } });
  const byDate = new Map(checkIns.map((c) => [c.date.toISOString().slice(0, 10), c]));
  const todayRec = byDate.get(todayStr);

  const rows: DayRow[] = [];
  if (checkIns.length) {
    const first = checkIns[0].date.toISOString().slice(0, 10);
    for (const day of weekdaysBetween(first, todayStr)) {
      const c = byDate.get(day);
      if (c) rows.push({ date: c.date, status: c.status as Status });
      else if (day !== todayStr) rows.push({ date: toUtcDate(day), status: 'ABSENT' });
    }
    for (const c of checkIns) if (!rows.some((r) => r.date.getTime() === c.date.getTime())) rows.push({ date: c.date, status: c.status as Status });
  }

  const dow = toUtcDate(todayStr).getUTCDay();
  return {
    timezone: tz,
    today: {
      date: todayStr,
      marked: !!todayRec,
      status: todayRec?.status ?? null,
      checkedInAt: todayRec?.checkedInAt ?? null,
      checkedInTime: todayRec ? localTimeString(tz, todayRec.checkedInAt) : null,
      canCheckIn: !todayRec,
      reason: todayRec ? 'Already checked in today.' : dow === 0 || dow === 6 ? 'Today is a weekend (check-in is still allowed).' : null,
    },
    ...buildOverview(rows, month, todayStr),
  };
};
