import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { buildOverview, localDateString, weekdaysBetween } from '../src/modules/attendance/attendance-stats';
import { riskOf } from '../src/modules/progress/progress.metrics';
import { bearer, tokenFor } from './helpers';

const app = createApp();
const TMP_PASSWORD = 'Passw0rdX';
const emails = { student: 'tmp.checkin.student@schoolone.com', teacher: 'tmp.checkin.teacher@schoolone.com' };

let adminOne = '';
let adminTwo = '';
let demoTeacher = '';
let parent = '';
let student = '';
let tmpTeacher = '';
let studentId = '';
let sectionId = '';
let schoolTwoStudentId = '';
let today = '';

const login = async (identifier: string) => {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier, password: TMP_PASSWORD });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
};

beforeAll(async () => {
  adminOne = (await tokenFor(app, 'admin@schoolone.com')).token;
  adminTwo = (await tokenFor(app, 'admin@schooltwo.com')).token;
  demoTeacher = (await tokenFor(app, 'teacher@schoolone.com')).token;
  parent = (await tokenFor(app, 'parent@schoolone.com')).token;

  const school = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' }, include: { settings: true } });
  today = localDateString(school.settings?.timezone ?? 'UTC');

  // Use the demo teacher's own section so the roster-override path is exercised.
  const demoTeacherRow = await prisma.teacher.findFirstOrThrow({ where: { user: { email: 'teacher@schoolone.com' } }, include: { classes: true } });
  const assigned = demoTeacherRow.classes[0];
  sectionId = assigned.sectionId;

  for (const [key, role] of [['student', 'STUDENT'], ['teacher', 'TEACHER']] as const) {
    const res = await request(app)
      .post('/api/v1/users')
      .set(bearer(adminOne))
      .send({ email: emails[key], password: TMP_PASSWORD, firstName: 'Tmp', lastName: `Checkin${role}`, role });
    expect(res.status).toBe(201);
  }
  const s = await prisma.student.findFirstOrThrow({ where: { user: { email: emails.student } } });
  studentId = s.id;
  await prisma.student.update({ where: { id: s.id }, data: { classId: assigned.classId, sectionId } });
  await prisma.teacherAttendance.deleteMany({ where: { teacher: { user: { email: emails.teacher } } } });

  student = await login(emails.student);
  tmpTeacher = await login(emails.teacher);
  schoolTwoStudentId = (await prisma.student.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } })).id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(emails) } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.student.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { resource: 'USER', resourceId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe('student self check-in', () => {
  it('starts as eligible, marks once, and returns 409 the second time', async () => {
    // Locked until the student has spent 5 active minutes on the platform today.
    const locked = await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect(locked.body.data.today).toMatchObject({ canCheckIn: false, lockedBy: 'usage', requiredSeconds: 300 });
    expect((await request(app).post('/api/v1/attendance/check-in').set(bearer(student))).status).toBe(400);

    const userId = (await prisma.student.findUniqueOrThrow({ where: { id: studentId } })).userId!;
    await prisma.usageDay.upsert({
      where: { userId_date: { userId, date: new Date(`${today}T00:00:00.000Z`) } },
      update: { seconds: 300 }, create: { userId, date: new Date(`${today}T00:00:00.000Z`), seconds: 300 },
    });

    const before = await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect(before.status).toBe(200);
    expect(before.body.data.today.canCheckIn).toBe(true);
    expect(before.body.data.today.marked).toBe(false);
    expect(before.body.data.overall.totalDays).toBe(0);

    const first = await request(app).post('/api/v1/attendance/check-in').set(bearer(student));
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('PRESENT');

    const second = await request(app).post('/api/v1/attendance/check-in').set(bearer(student));
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/already marked/i);

    const after = await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect(after.body.data.today).toMatchObject({ marked: true, status: 'PRESENT', source: 'SELF', canCheckIn: false, date: today });
    expect(after.body.data.overall).toMatchObject({ percentage: 100, present: 1, totalDays: 1 });
    expect(after.body.data.streak).toEqual({ current: 1, longest: 1 });
    expect(after.body.data.month.days).toEqual([{ date: today, status: 'PRESENT' }]);
    expect(after.body.data.trend).toHaveLength(6);
  });

  it('is audit-logged', async () => {
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
    expect(rec.source).toBe('SELF');
    expect(await prisma.auditLog.count({ where: { action: 'CHECK_IN', resource: 'ATTENDANCE_RECORD', resourceId: rec.id } })).toBe(1);
  });

  it('a teacher roster save overrides the self check-in', async () => {
    const res = await request(app)
      .post('/api/v1/attendance')
      .set(bearer(demoTeacher))
      .send({ sectionId, date: today, records: [{ studentId, status: 'ABSENT' }] });
    expect(res.status).toBe(201);
    const rec = await prisma.attendanceRecord.findFirstOrThrow({ where: { studentId } });
    expect(rec).toMatchObject({ status: 'ABSENT', source: 'TEACHER', checkedInAt: null });
    const me = await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect(me.body.data.overall).toMatchObject({ percentage: 0, absent: 1 });
    expect(me.body.data.streak.current).toBe(0);
  });

  it('is student-only and never trusts a client-supplied student', async () => {
    for (const token of [demoTeacher, adminOne, parent]) {
      expect((await request(app).post('/api/v1/attendance/check-in').set(bearer(token)).send({ studentId })).status).toBe(403);
    }
    expect((await request(app).post('/api/v1/attendance/check-in')).status).toBe(401);
    expect((await request(app).get('/api/v1/attendance/me').set(bearer(demoTeacher))).status).toBe(403);
  });

  it('rejects students without a class, and heals a class with no section', async () => {
    const original = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    await prisma.student.update({ where: { id: studentId }, data: { classId: null, sectionId: null } });
    const res = await request(app).post('/api/v1/attendance/check-in').set(bearer(student));
    expect(res.status).toBe(400);
    const me = await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect(me.body.data.today.canCheckIn).toBe(false);
    expect(me.body.data.today.reason).toMatch(/no class/i);

    // Class but no section: the class's default section is assigned automatically.
    await prisma.student.update({ where: { id: studentId }, data: { classId: original.classId, sectionId: null } });
    await request(app).get('/api/v1/attendance/me').set(bearer(student));
    expect((await prisma.student.findUniqueOrThrow({ where: { id: studentId } })).sectionId).not.toBeNull();
    await prisma.student.update({ where: { id: studentId }, data: { classId: original.classId, sectionId } });
  });
});

describe('parents', () => {
  it('see only their own children and cannot check in', async () => {
    const own = await request(app).get('/api/v1/attendance/me').set(bearer(parent));
    expect(own.status).toBe(200);
    expect(own.body.data.children.length).toBeGreaterThan(0);
    expect(own.body.data.today.canCheckIn).toBe(false);
    const foreign = await request(app).get(`/api/v1/attendance/me?studentId=${schoolTwoStudentId}`).set(bearer(parent));
    expect(foreign.status).toBe(403);
  });
});

describe('teacher self check-in', () => {
  it('checks in once per day and reports own attendance', async () => {
    expect((await request(app).post('/api/v1/attendance/teacher/check-in').set(bearer(tmpTeacher))).status).toBe(201);
    expect((await request(app).post('/api/v1/attendance/teacher/check-in').set(bearer(tmpTeacher))).status).toBe(409);
    const me = await request(app).get('/api/v1/attendance/teacher/me').set(bearer(tmpTeacher));
    expect(me.status).toBe(200);
    expect(me.body.data.today).toMatchObject({ marked: true, canCheckIn: false });
    expect(me.body.data.overall.percentage).toBe(100);
    expect((await request(app).post('/api/v1/attendance/teacher/check-in').set(bearer(student))).status).toBe(403);
    expect((await request(app).get('/api/v1/attendance/teacher/me').set(bearer(adminOne))).status).toBe(403);
  });
});

describe('progress tracking', () => {
  it('lists students with computed metrics and risk, scoped to the caller school', async () => {
    const res = await request(app).get('/api/v1/progress/students?search=Tmp&pageSize=10').set(bearer(adminOne));
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { studentId: string }) => r.studentId === studentId);
    expect(row).toMatchObject({ attendancePct: 0, riskLevel: 'at_risk', assignmentsSubmitted: 0 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);

    const other = await request(app).get('/api/v1/progress/students?pageSize=100').set(bearer(adminTwo));
    expect(other.body.data.some((r: { studentId: string }) => r.studentId === studentId)).toBe(false);
    expect(other.body.data.length).toBeGreaterThan(0);
  });

  it('filters by risk and sorts by a computed metric across pages', async () => {
    const risky = await request(app).get('/api/v1/progress/students?risk=at_risk&pageSize=100').set(bearer(adminOne));
    expect(risky.body.data.every((r: { riskLevel: string }) => r.riskLevel === 'at_risk')).toBe(true);
    expect(risky.body.data.some((r: { studentId: string }) => r.studentId === studentId)).toBe(true);

    const sorted = await request(app).get('/api/v1/progress/students?sortBy=attendancePct&sortOrder=asc&pageSize=100').set(bearer(adminOne));
    const vals = sorted.body.data.map((r: { attendancePct: number | null }) => r.attendancePct ?? -1);
    expect(vals).toEqual([...vals].sort((a: number, b: number) => a - b));
  });

  it('tenant isolation on student detail', async () => {
    expect((await request(app).get(`/api/v1/progress/students/${studentId}`).set(bearer(adminTwo))).status).toBe(404);
    expect((await request(app).get(`/api/v1/progress/students/${schoolTwoStudentId}`).set(bearer(adminOne))).status).toBe(404);
    const ok = await request(app).get(`/api/v1/progress/students/${studentId}`).set(bearer(adminOne));
    expect(ok.status).toBe(200);
    expect(ok.body.data.student.id).toBe(studentId);
    expect(ok.body.data.attendance.overall.totalDays).toBe(1);
    expect(Array.isArray(ok.body.data.subjects)).toBe(true);
  });

  it('teachers only see students of their assigned sections and no teacher table', async () => {
    const res = await request(app).get('/api/v1/progress/students?pageSize=100').set(bearer(demoTeacher));
    expect(res.status).toBe(200);
    const allowed = await prisma.teacherClass.findMany({ where: { teacher: { user: { email: 'teacher@schoolone.com' } } }, select: { sectionId: true } });
    const ids = res.body.data.map((r: { studentId: string }) => r.studentId);
    const rows = await prisma.student.findMany({ where: { id: { in: ids } }, select: { sectionId: true } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => allowed.some((a) => a.sectionId === r.sectionId))).toBe(true);
    expect((await request(app).get('/api/v1/progress/teachers').set(bearer(demoTeacher))).status).toBe(403);
  });

  it('students and parents cannot use progress endpoints', async () => {
    for (const token of [student, parent]) {
      expect((await request(app).get('/api/v1/progress/students').set(bearer(token))).status).toBe(403);
      expect((await request(app).get('/api/v1/progress/summary').set(bearer(token))).status).toBe(403);
    }
  });

  it('summarises risk levels', async () => {
    const res = await request(app).get('/api/v1/progress/summary').set(bearer(adminOne));
    expect(res.status).toBe(200);
    const { risk, totalStudents } = res.body.data;
    expect(risk.ok + risk.watch + risk.at_risk).toBe(totalStudents);
    expect(res.body.data.lowestAttendance.length).toBeLessThanOrEqual(5);
  });

  it('shows teacher activity to admins only, within their school', async () => {
    const res = await request(app).get('/api/v1/progress/teachers?search=Tmp').set(bearer(adminOne));
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: { employeeId: string; name: string }) => r.name.includes('CheckinTEACHER'));
    expect(row).toMatchObject({ attendancePct: 100, assignmentsCreated: 0 });
    for (const k of ['subjects', 'classes', 'daysAttendanceMarked30d', 'diaryEntries30d', 'noticesPublished', 'lastActiveAt']) expect(row).toHaveProperty(k);

    const detail = await request(app).get(`/api/v1/progress/teachers/${row.teacherId}`).set(bearer(adminOne));
    expect(detail.status).toBe(200);
    expect(detail.body.data.attendance.today.marked).toBe(true);
    expect((await request(app).get(`/api/v1/progress/teachers/${row.teacherId}`).set(bearer(adminTwo))).status).toBe(404);

    const two = await request(app).get('/api/v1/progress/teachers?pageSize=100').set(bearer(adminTwo));
    expect(two.body.data.some((r: { teacherId: string }) => r.teacherId === row.teacherId)).toBe(false);
  });
});

describe('percentage, trend and streak math', () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const rows = [
    { date: d('2026-03-02'), status: 'PRESENT' as const },
    { date: d('2026-03-03'), status: 'LATE' as const },
    { date: d('2026-03-04'), status: 'ABSENT' as const },
    { date: d('2026-03-05'), status: 'EXCUSED' as const },
    { date: d('2026-03-06'), status: 'PRESENT' as const },
    { date: d('2026-03-09'), status: 'PRESENT' as const },
  ];

  it('counts PRESENT + LATE as attended; ABSENT and EXCUSED count against', () => {
    const o = buildOverview(rows, '2026-03', '2026-03-09');
    expect(o.overall).toMatchObject({ present: 3, late: 1, absent: 1, excused: 1, totalDays: 6, percentage: 66.7 });
    expect(o.month.percentage).toBe(66.7);
    expect(o.month.days).toHaveLength(6);
  });

  it('computes current and longest streaks', () => {
    const o = buildOverview(rows, '2026-03', '2026-03-09');
    expect(o.streak).toEqual({ current: 2, longest: 2 });
    expect(buildOverview([{ date: d('2026-03-02'), status: 'ABSENT' }], '2026-03', '2026-03-02').streak).toEqual({ current: 0, longest: 0 });
  });

  it('builds a 6-month trend ending at the current month, null where no data', () => {
    const t = buildOverview(rows, '2026-03', '2026-03-09').trend;
    expect(t.map((x) => x.month)).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03']);
    expect(t.slice(0, 5).every((x) => x.percentage === null)).toBe(true);
    expect(t[5].percentage).toBe(66.7);
  });

  it('handles empty history and weekdays', () => {
    expect(buildOverview([], '2026-03', '2026-03-09').overall.percentage).toBe(0);
    expect(weekdaysBetween('2026-03-06', '2026-03-10')).toEqual(['2026-03-06', '2026-03-09', '2026-03-10']);
  });

  it('classifies risk: <75 attendance or <40 average is at risk; <85 / <55 is watch; no data never raises risk', () => {
    expect(riskOf(74.9, 90)).toBe('at_risk');
    expect(riskOf(95, 39)).toBe('at_risk');
    expect(riskOf(80, 90)).toBe('watch');
    expect(riskOf(95, 50)).toBe('watch');
    expect(riskOf(90, 60)).toBe('ok');
    expect(riskOf(null, null)).toBe('ok');
  });
});
