import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { publishDueNotices } from '../src/modules/notices/notices.publisher';
import { app, as, tokenFor } from './ops-helpers';

const started = new Date();
const createdFiles: string[] = [];
const createdDiary: string[] = [];
const createdNotices: string[] = [];

afterAll(async () => {
  await prisma.diaryEntry.deleteMany({ where: { id: { in: createdDiary } } });
  await prisma.file.deleteMany({ where: { id: { in: createdFiles } } });
  await prisma.notice.deleteMany({ where: { id: { in: createdNotices } } });
  await prisma.notification.deleteMany({ where: { title: { startsWith: 'HARDENING' }, createdAt: { gte: started } } });
  await prisma.$disconnect();
});

describe('modules endpoints', () => {
  it('lists enabled modules per school (instasolve off for school one, v-buddy off for school two)', async () => {
    const one = await (await as('student@schoolone.com')).get('/api/v1/modules/enabled');
    expect(one.status).toBe(200);
    expect(one.body.data).toContain('v-buddy');
    expect(one.body.data).not.toContain('instasolve');
    const two = await (await as('admin@schooltwo.com')).get('/api/v1/modules/enabled');
    expect(two.body.data).toContain('instasolve');
    expect(two.body.data).not.toContain('v-buddy');
  });

  it('management endpoints are super-admin only', async () => {
    for (const email of ['admin@schoolone.com', 'teacher@schoolone.com', 'student@schoolone.com']) {
      const c = await as(email);
      expect((await c.get('/api/v1/modules')).status).toBe(403);
      expect((await c.patch('/api/v1/modules/attendance', { enabled: false })).status).toBe(403);
    }
  });

  it('super admin toggles a module for one school only', async () => {
    const school = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } });
    const url = `/api/v1/modules/school/${school.id}/pedagogy`;
    const auth = { Authorization: `Bearer ${await tokenFor('superadmin@example.com')}` };
    try {
      const off = await request(app).put(url).set(auth).send({ enabled: false });
      expect(off.status).toBe(200);
      expect((await (await as('admin@schoolone.com')).get('/api/v1/modules/enabled')).body.data).not.toContain('pedagogy');
      expect((await (await as('admin@schooltwo.com')).get('/api/v1/modules/enabled')).body.data).toContain('pedagogy');
    } finally {
      await request(app).put(url).set(auth).send({ enabled: true });
    }
    expect((await (await as('admin@schoolone.com')).get('/api/v1/modules/enabled')).body.data).toContain('pedagogy');
  });
});

describe('security endpoints', () => {
  it('are restricted to admins', async () => {
    for (const email of ['teacher@schoolone.com', 'student@schoolone.com', 'parent@schoolone.com']) {
      const c = await as(email);
      expect((await c.get('/api/v1/security/audit-logs')).status).toBe(403);
      expect((await c.get('/api/v1/security/sessions')).status).toBe(403);
    }
  });

  it('school admin only sees own-school audit logs, sessions and login activity', async () => {
    const school = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } });
    const c = await as('admin@schoolone.com');
    const logs = await c.get('/api/v1/security/audit-logs?pageSize=100');
    expect(logs.status).toBe(200);
    expect((logs.body.data as { schoolId: string | null }[]).every((l) => l.schoolId === school.id)).toBe(true);
    // A client-supplied schoolId must be ignored for non-super admins.
    const other = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-TWO' } });
    const spoof = await c.get(`/api/v1/security/audit-logs?pageSize=100&schoolId=${other.id}`);
    expect((spoof.body.data as { schoolId: string | null }[]).every((l) => l.schoolId === school.id)).toBe(true);

    const sessions = await c.get('/api/v1/security/sessions?pageSize=100');
    expect(sessions.status).toBe(200);
    const users = await prisma.user.findMany({ where: { id: { in: (sessions.body.data as { user: { id: string } }[]).map((s) => s.user.id) } }, select: { schoolId: true } });
    expect(users.every((u) => u.schoolId === school.id)).toBe(true);
    expect((await c.get('/api/v1/security/failed-logins')).status).toBe(200);
  });

  it("another school's admin cannot revoke a session (404), super admin sees everything", async () => {
    const one = await as('admin@schoolone.com');
    const sessions = await one.get('/api/v1/security/sessions?pageSize=1');
    const id = sessions.body.data[0].id as string;
    expect((await (await as('admin@schooltwo.com')).del(`/api/v1/security/sessions/${id}`)).status).toBe(404);
    const su = await (await as('superadmin@example.com')).get('/api/v1/security/audit-logs?pageSize=100');
    expect(su.status).toBe(200);
    expect(su.body.meta.total).toBeGreaterThanOrEqual(1);
  });
});

describe('students self profile', () => {
  it('GET /students/me returns the student’s own profile only', async () => {
    const me = await (await as('student@schoolone.com')).get('/api/v1/students/me');
    expect(me.status).toBe(200);
    expect(me.body.data.admissionNumber).toMatch(/^GF/);
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
    expect((await (await as('teacher@schoolone.com')).get('/api/v1/students/me')).status).toBe(403);
    expect((await (await as('parent@schoolone.com')).get('/api/v1/students/me')).status).toBe(403);
  });

  it('parents list only their own children', async () => {
    const res = await (await as('parent@schoolone.com')).get('/api/v1/students?pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(10);
    const parent = await prisma.parent.findFirstOrThrow({ where: { user: { email: 'parent@schoolone.com' } } });
    const rows = await prisma.student.findMany({ where: { id: { in: res.body.data.map((s: { id: string }) => s.id) } }, select: { parentId: true } });
    expect(rows.every((r) => r.parentId === parent.id)).toBe(true);
  });
});

describe('diary attachments', () => {
  it('accepts a same-school file and rejects a file from another school', async () => {
    const teacherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@schoolone.com' }, include: { teacher: { include: { classes: true } } } });
    const [schoolOne, schoolTwo] = await Promise.all([
      prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } }),
      prisma.school.findUniqueOrThrow({ where: { code: 'SCH-TWO' } }),
    ]);
    const mk = (schoolId: string, key: string) =>
      prisma.file.create({ data: { schoolId, uploadedById: teacherUser.id, originalName: 'x.pdf', mimeType: 'application/pdf', size: 1, storageKey: `hardening-${started.getTime()}-${key}` } });
    const [own, foreign] = await Promise.all([mk(schoolOne.id, 'a'), mk(schoolTwo.id, 'b')]);
    createdFiles.push(own.id, foreign.id);
    const pair = teacherUser.teacher!.classes[0];
    const base = { classId: pair.classId, sectionId: pair.sectionId, title: `HARDENING diary ${started.getTime()}`, body: 'Read chapter 1' };

    const t = await as('teacher@schoolone.com');
    const good = await t.post('/api/v1/diary', { ...base, fileId: own.id });
    expect(good.status).toBe(201);
    expect(good.body.data.fileId).toBe(own.id);
    createdDiary.push(good.body.data.id);
    expect((await t.post('/api/v1/diary', { ...base, fileId: foreign.id })).status).toBe(404);

    const upd = await t.patch(`/api/v1/diary/${good.body.data.id}`, { fileId: foreign.id });
    expect(upd.status).toBe(404);
    const cleared = await t.patch(`/api/v1/diary/${good.body.data.id}`, { fileId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.fileId).toBeNull();
  });
});

describe('teacher deactivation', () => {
  it('deactivating a teacher blocks login and revokes sessions', async () => {
    const admin = await as('admin@schoolone.com');
    const email = `hardening.${started.getTime()}@schoolone.com`;
    const created = await admin.post('/api/v1/teachers', { email, password: 'Passw0rd!x', firstName: 'Tmp', lastName: 'Teacher', employeeId: `H${started.getTime()}` });
    expect(created.status).toBe(201);
    const login = async () => request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'Passw0rd!x' });
    const first = await login();
    expect(first.status).toBe(200);
    try {
      expect((await admin.del(`/api/v1/teachers/${created.body.data.id}`)).status).toBe(200);
      expect((await login()).status).toBe(403);
      const rt = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first.body.data.refreshToken });
      expect(rt.status).toBe(401);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});

describe('scheduled notice publisher', () => {
  it('notifies once when publishAt has passed', async () => {
    const school = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } });
    const author = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@schoolone.com' } });
    const notice = await prisma.notice.create({
      data: { schoolId: school.id, authorId: author.id, title: `HARDENING notice ${started.getTime()}`, body: 'Scheduled', isPublished: true, publishAt: new Date(Date.now() - 1000), targets: { create: [{ roleName: 'STUDENT' }] } },
    });
    createdNotices.push(notice.id);
    const before = await prisma.notification.count({ where: { title: notice.title } });
    expect(await publishDueNotices()).toBeGreaterThanOrEqual(1);
    const after = await prisma.notification.count({ where: { title: notice.title } });
    expect(after).toBeGreaterThan(before);
    expect((await prisma.notice.findUniqueOrThrow({ where: { id: notice.id } })).notifiedAt).not.toBeNull();
    expect(await publishDueNotices()).toBe(0);
    expect(await prisma.notification.count({ where: { title: notice.title } })).toBe(after);
  });

  it('does not notify for future publish times', async () => {
    const school = await prisma.school.findUniqueOrThrow({ where: { code: 'SCH-ONE' } });
    const author = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@schoolone.com' } });
    const notice = await prisma.notice.create({
      data: { schoolId: school.id, authorId: author.id, title: `HARDENING future ${started.getTime()}`, body: 'Later', isPublished: true, publishAt: new Date(Date.now() + 3_600_000) },
    });
    createdNotices.push(notice.id);
    await publishDueNotices();
    expect((await prisma.notice.findUniqueOrThrow({ where: { id: notice.id } })).notifiedAt).toBeNull();
  });
});
