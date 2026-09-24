import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { prisma } from '../src/config/database';
import { app, as } from './ops-helpers';

let studentUserId: string;
let teacherUserId: string;

beforeAll(async () => {
  studentUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'student@schoolone.com' } })).id;
  teacherUserId = (await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@schoolone.com' } })).id;
  await prisma.notification.createMany({
    data: [
      { userId: studentUserId, type: 'SYSTEM', title: 'TEST n1', message: 'one' },
      { userId: studentUserId, type: 'SYSTEM', title: 'TEST n2', message: 'two' },
      { userId: teacherUserId, type: 'SYSTEM', title: 'TEST teacher-only', message: 'secret' },
    ],
  });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { title: { startsWith: 'TEST ' } } });
  await prisma.$disconnect();
});

describe('notifications', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
  });

  it('lists only own notifications with unread count', async () => {
    const res = await (await as('student@schoolone.com')).get('/api/v1/notifications?pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.meta.unreadCount).toBeGreaterThanOrEqual(2);
    expect(res.body.data.some((n: { title: string }) => n.title === 'TEST teacher-only')).toBe(false);
  });

  it('marks one as read; cannot touch someone else notification', async () => {
    const student = await as('student@schoolone.com');
    const list = await student.get('/api/v1/notifications?search=TEST n1');
    const id = list.body.data[0].id;
    expect((await student.patch(`/api/v1/notifications/${id}/read`)).body.data.read).toBe(true);
    const teacherNote = await prisma.notification.findFirstOrThrow({ where: { title: 'TEST teacher-only' } });
    expect((await student.patch(`/api/v1/notifications/${teacherNote.id}/read`)).status).toBe(404);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: teacherNote.id } })).read).toBe(false);
  });

  it('marks all as read', async () => {
    const student = await as('student@schoolone.com');
    expect((await student.patch('/api/v1/notifications/read-all')).status).toBe(200);
    const res = await student.get('/api/v1/notifications?unread=true');
    expect(res.body.meta.unreadCount).toBe(0);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('global search', () => {
  it('returns categorized results scoped to the tenant', async () => {
    const admin = await as('admin@schoolone.com');
    const res = await admin.get('/api/v1/search?q=Grade');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['courses', 'notices', 'resources', 'schools', 'students', 'teachers']);
    expect(res.body.data.schools).toEqual([]);
  });

  it('school search is super-admin only and short queries are rejected', async () => {
    const sa = await as('superadmin@example.com');
    const res = await sa.get('/api/v1/search?q=Greenfield');
    expect(res.body.data.schools.length).toBeGreaterThan(0);
    expect((await sa.get('/api/v1/search?q=a')).status).toBe(400);
    const other = await (await as('admin@schooltwo.com')).get('/api/v1/search?q=Greenfield');
    expect(other.body.data.schools).toEqual([]);
  });

  it('students search never leaks another school', async () => {
    const res = await (await as('admin@schooltwo.com')).get('/api/v1/search?q=GF20&limit=10');
    expect(res.body.data.students).toEqual([]);
  });
});

describe('reports', () => {
  it('school admin gets JSON and CSV student attendance', async () => {
    const admin = await as('admin@schoolone.com');
    const json = await admin.get('/api/v1/reports/student-attendance');
    expect(json.status).toBe(200);
    expect(json.body.data.rows.length).toBeGreaterThan(0);
    const csv = await admin.get('/api/v1/reports/student-attendance?format=csv');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n')[0]).toContain('admissionNumber');
  });

  it('students are forbidden; teachers cannot run admin-only reports; schools are isolated', async () => {
    expect((await (await as('student@schoolone.com')).get('/api/v1/reports/enrollment')).status).toBe(403);
    expect((await (await as('teacher@schoolone.com')).get('/api/v1/reports/school-statistics')).status).toBe(403);
    const stats = await (await as('admin@schooltwo.com')).get('/api/v1/reports/school-statistics');
    expect(stats.body.data.rows).toHaveLength(1);
    expect(stats.body.data.rows[0].code).toBe('SCH-TWO');
    expect((await (await as('admin@schoolone.com')).get('/api/v1/reports/nonsense')).status).toBe(400);
  });
});
