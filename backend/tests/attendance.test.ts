import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { as } from './ops-helpers';

const DATE = '2020-01-06';
const started = new Date();
let sectionId: string;
let otherSectionId: string;
let studentId: string;
let otherStudentId: string;

beforeAll(async () => {
  const teacher = await prisma.teacher.findFirstOrThrow({ where: { user: { email: 'teacher@schoolone.com' } }, include: { classes: true } });
  sectionId = teacher.classes[0].sectionId;
  const own = await prisma.student.findFirstOrThrow({ where: { user: { email: 'student@schoolone.com' } } });
  studentId = own.id;
  // A section of the same school the teacher is NOT assigned to.
  otherSectionId = (await prisma.section.findFirstOrThrow({ where: { schoolId: teacher.schoolId, id: { notIn: teacher.classes.map((c) => c.sectionId) } } })).id;
  otherStudentId = (await prisma.student.findFirstOrThrow({ where: { sectionId, id: { not: studentId } } })).id;
});

afterAll(async () => {
  await prisma.attendance.deleteMany({ where: { sectionId, date: new Date(`${DATE}T00:00:00Z`) } });
  await prisma.notification.deleteMany({ where: { type: 'ATTENDANCE', createdAt: { gte: started } } });
  await prisma.auditLog.deleteMany({ where: { resource: { in: ['ATTENDANCE', 'ATTENDANCE_RECORD'] }, createdAt: { gte: started } } });
  await prisma.$disconnect();
});

describe('attendance', () => {
  it('teacher loads the roster of an assigned section', async () => {
    const teacher = await as('teacher@schoolone.com');
    const res = await teacher.get(`/api/v1/attendance/section-roster?sectionId=${sectionId}&date=${DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.data.students.length).toBeGreaterThan(0);
  });

  it('teacher bulk-marks attendance, re-marking upserts, and absentees are notified', async () => {
    const teacher = await as('teacher@schoolone.com');
    const body = { sectionId, date: DATE, records: [{ studentId, status: 'ABSENT' }, { studentId: otherStudentId, status: 'PRESENT' }] };
    expect((await teacher.post('/api/v1/attendance', body)).status).toBe(201);
    body.records[0].status = 'LATE';
    expect((await teacher.post('/api/v1/attendance', body)).status).toBe(201);
    expect(await prisma.attendanceRecord.count({ where: { attendance: { sectionId, date: new Date(`${DATE}T00:00:00Z`) } } })).toBe(2);
    // First mark was ABSENT -> student got a notification
    const student = await as('student@schoolone.com');
    const notes = await student.get('/api/v1/notifications?type=ATTENDANCE');
    expect(notes.body.data.length).toBeGreaterThan(0);
  });

  it('rejects marking a section the teacher is not assigned to', async () => {
    const teacher = await as('teacher@schoolone.com');
    const res = await teacher.post('/api/v1/attendance', { sectionId: otherSectionId, date: DATE, records: [{ studentId, status: 'PRESENT' }] });
    expect(res.status).toBe(403);
  });

  it('rejects students that are not in the section', async () => {
    const teacher = await as('teacher@schoolone.com');
    const stranger = await prisma.student.findFirstOrThrow({ where: { sectionId: { not: sectionId }, school: { code: 'SCH-ONE' } } });
    const res = await teacher.post('/api/v1/attendance', { sectionId, date: DATE, records: [{ studentId: stranger.id, status: 'PRESENT' }] });
    expect(res.status).toBe(400);
  });

  it('validates input', async () => {
    const teacher = await as('teacher@schoolone.com');
    const res = await teacher.post('/api/v1/attendance', { sectionId, date: 'nope', records: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('students cannot mark attendance (403) but can read only their own', async () => {
    const student = await as('student@schoolone.com');
    expect((await student.post('/api/v1/attendance', { sectionId, date: DATE, records: [{ studentId, status: 'PRESENT' }] })).status).toBe(403);
    const list = await student.get(`/api/v1/attendance?date=${DATE}`);
    expect(list.status).toBe(200);
    expect(list.body.data.every((r: { studentId: string }) => r.studentId === studentId)).toBe(true);
    expect((await student.get(`/api/v1/attendance?studentId=${otherStudentId}`)).status).toBe(403);
  });

  it('parent can read a child attendance summary', async () => {
    const parent = await as('parent@schoolone.com');
    const res = await parent.get(`/api/v1/attendance/summary?studentId=${studentId}&month=2020-01`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.counts.LATE).toBe(1);
    expect(res.body.data.percentage).toBe(100);
  });

  it('school admin edits a record; other school cannot see or edit it', async () => {
    const admin = await as('admin@schoolone.com');
    const list = await admin.get(`/api/v1/attendance?sectionId=${sectionId}&date=${DATE}`);
    expect(list.body.data.length).toBe(2);
    const recordId = list.body.data[0].id;
    expect((await admin.patch(`/api/v1/attendance/${recordId}`, { status: 'EXCUSED' })).status).toBe(200);

    const other = await as('admin@schooltwo.com');
    expect((await other.patch(`/api/v1/attendance/${recordId}`, { status: 'PRESENT' })).status).toBe(404);
    expect((await other.get(`/api/v1/attendance/section-roster?sectionId=${sectionId}&date=${DATE}`)).status).toBe(404);
    const otherList = await other.get(`/api/v1/attendance?date=${DATE}`);
    expect(otherList.body.data.length).toBe(0);
  });
});
