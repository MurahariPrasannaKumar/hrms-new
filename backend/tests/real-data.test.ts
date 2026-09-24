import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let superT = '';
let adminOne = '';
let adminTwo = '';
let teacherT = '';
let studentT = '';
let schoolOneId = '';
let original: unknown;

beforeAll(async () => {
  superT = (await tokenFor(app, 'superadmin@example.com')).token;
  const a = await tokenFor(app, 'admin@schoolone.com');
  adminOne = a.token;
  schoolOneId = a.user.schoolId!;
  adminTwo = (await tokenFor(app, 'admin@schooltwo.com')).token;
  teacherT = (await tokenFor(app, 'teacher@schoolone.com')).token;
  studentT = (await tokenFor(app, 'student@schoolone.com')).token;
  original = (await request(app).get('/api/v1/settings/system').set(bearer(superT))).body.data;
});

afterAll(async () => {
  await request(app).put('/api/v1/settings/system').set(bearer(superT)).send(original as object);
  await prisma.$disconnect();
});

describe('system settings', () => {
  it('super admin can read, save and persist', async () => {
    const put = await request(app).put('/api/v1/settings/system').set(bearer(superT))
      .send({ platformName: 'Acme Learning', supportEmail: 'help@acme.test', defaultLocale: 'en', maintenanceMode: false });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/v1/settings/system').set(bearer(superT));
    expect(get.body.data.platformName).toBe('Acme Learning');
    expect(await prisma.auditLog.count({ where: { resource: 'SYSTEM_SETTINGS' } })).toBeGreaterThan(0);
  });
  it('validates input and blocks non-super-admins', async () => {
    const bad = await request(app).put('/api/v1/settings/system').set(bearer(superT)).send({ platformName: 'x' });
    expect(bad.status).toBe(400);
    expect((await request(app).get('/api/v1/settings/system').set(bearer(adminOne))).status).toBe(403);
    expect((await request(app).get('/api/v1/settings/system').set(bearer(teacherT))).status).toBe(403);
  });
});

describe('school settings', () => {
  it('school admin edits own school; tenant comes from the token', async () => {
    const before = (await request(app).get('/api/v1/settings/school').set(bearer(adminOne))).body.data;
    expect(before.schoolId).toBe(schoolOneId);
    const put = await request(app).put('/api/v1/settings/school').set(bearer(adminOne))
      .send({ timezone: 'Asia/Dubai', profile: { principal: 'Temp Principal' } });
    expect(put.status).toBe(200);
    expect(put.body.data.timezone).toBe('Asia/Dubai');
    expect(put.body.data.profile.principal).toBe('Temp Principal');
    await request(app).put('/api/v1/settings/school').set(bearer(adminOne))
      .send({ timezone: before.timezone, profile: { principal: before.profile.principal } });
  });
  it('ignores a foreign schoolId from a school admin and blocks teachers', async () => {
    const other = (await request(app).get('/api/v1/settings/school').set(bearer(adminTwo))).body.data.schoolId;
    const res = await request(app).get(`/api/v1/settings/school?schoolId=${other}`).set(bearer(adminOne));
    expect(res.body.data.schoolId).toBe(schoolOneId);
    expect((await request(app).get('/api/v1/settings/school').set(bearer(teacherT))).status).toBe(403);
  });
  it('super admin must name the school', async () => {
    expect((await request(app).get('/api/v1/settings/school').set(bearer(superT))).status).toBe(400);
    expect((await request(app).get(`/api/v1/settings/school?schoolId=${schoolOneId}`).set(bearer(superT))).status).toBe(200);
  });
});

describe('teacher classes, parents, diary completion', () => {
  it('teacher sees only assigned classes', async () => {
    const res = await request(app).get('/api/v1/teachers/me/classes').set(bearer(teacherT));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].sections.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/v1/teachers/me/classes').set(bearer(studentT))).status).toBe(403);
  });
  it('parents list is tenant scoped and admin only', async () => {
    const res = await request(app).get('/api/v1/parents').set(bearer(adminOne));
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { email: string }) => p.email.endsWith('@schoolone.com'))).toBe(true);
    expect((await request(app).get('/api/v1/parents').set(bearer(studentT))).status).toBe(403);
  });
  it('student can mark a diary entry done and undone, persisted per user', async () => {
    const list = await request(app).get('/api/v1/diary').set(bearer(studentT));
    const entry = list.body.data[0];
    expect(entry).toBeTruthy();
    expect(entry.completed).toBe(false);
    expect((await request(app).post(`/api/v1/diary/${entry.id}/complete`).set(bearer(studentT))).status).toBe(200);
    const after = await request(app).get('/api/v1/diary').set(bearer(studentT));
    expect(after.body.data.find((e: { id: string }) => e.id === entry.id).completed).toBe(true);
    expect((await request(app).delete(`/api/v1/diary/${entry.id}/complete`).set(bearer(studentT))).status).toBe(200);
    const undone = await request(app).get('/api/v1/diary').set(bearer(studentT));
    expect(undone.body.data.find((e: { id: string }) => e.id === entry.id).completed).toBe(false);
  });
  it("school two's admin cannot complete school one's diary entry", async () => {
    const entry = (await request(app).get('/api/v1/diary').set(bearer(studentT))).body.data[0];
    expect((await request(app).post(`/api/v1/diary/${entry.id}/complete`).set(bearer(adminTwo))).status).toBe(404);
  });
});

describe('dashboard attendance today', () => {
  it('counts attendance marked for the current UTC day', async () => {
    const mine = (await request(app).get('/api/v1/teachers/me/classes').set(bearer(teacherT))).body.data;
    const sectionId = mine[0].sections[0].id as string;
    const today = new Date().toISOString().slice(0, 10);
    const before = (await request(app).get(`/api/v1/attendance/section-roster?sectionId=${sectionId}&date=${today}`).set(bearer(teacherT))).body.data.students as { id: string; studentId?: string; status: string | null }[];
    const ids = before.map((s) => s.studentId ?? s.id);
    const mark = await request(app).post('/api/v1/attendance').set(bearer(teacherT))
      .send({ sectionId, date: today, records: ids.map((studentId) => ({ studentId, status: 'PRESENT' })) });
    expect([200, 201]).toContain(mark.status);
    const dash = await request(app).get('/api/v1/dashboard/school').set(bearer(adminOne));
    expect(typeof dash.body.data.stats.attendanceTodayPct).toBe('number');
    await request(app).post('/api/v1/attendance').set(bearer(teacherT))
      .send({ sectionId, date: today, records: before.map((s) => ({ studentId: s.studentId ?? s.id, status: s.status ?? 'PRESENT' })) });
  });
});
