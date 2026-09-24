import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database';
import { as } from './ops-helpers';

const created: string[] = [];
const started = new Date();
const title = (s: string) => `TEST ${s} ${started.getTime()}`;

afterAll(async () => {
  await prisma.notice.deleteMany({ where: { id: { in: created } } });
  await prisma.notification.deleteMany({ where: { type: 'NOTICE', createdAt: { gte: started } } });
  await prisma.auditLog.deleteMany({ where: { resource: 'NOTICE', createdAt: { gte: started } } });
  await prisma.$disconnect();
});

const makeNotice = async (body: object) => {
  const admin = await as('admin@schoolone.com');
  const res = await admin.post('/api/v1/notices', { type: 'GENERAL', body: 'Body text', ...body });
  expect(res.status).toBe(201);
  created.push(res.body.data.id);
  return res.body.data;
};
const visibleTo = async (email: string, id: string) => {
  const res = await (await as(email)).get(`/api/v1/notices?pageSize=100&search=${started.getTime()}`);
  return (res.body.data as { id: string }[]).some((n) => n.id === id);
};

describe('notices', () => {
  it('publishes a targeted notice: only targeted roles see it and they get notified', async () => {
    const n = await makeNotice({ title: title('teachers'), publish: true, targets: [{ roleName: 'TEACHER' }] });
    expect(await visibleTo('teacher@schoolone.com', n.id)).toBe(true);
    expect(await visibleTo('student@schoolone.com', n.id)).toBe(false);
    expect((await (await as('student@schoolone.com')).get(`/api/v1/notices/${n.id}`)).status).toBe(404);
    const teacherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@schoolone.com' } });
    expect(await prisma.notification.count({ where: { userId: teacherUser.id, type: 'NOTICE', createdAt: { gte: started } } })).toBeGreaterThan(0);
  });

  it('untargeted published notice is visible to everyone in the school', async () => {
    const n = await makeNotice({ title: title('all'), publish: true });
    for (const email of ['teacher@schoolone.com', 'student@schoolone.com', 'parent@schoolone.com']) expect(await visibleTo(email, n.id)).toBe(true);
  });

  it('drafts, scheduled and expired notices are hidden from non-managers', async () => {
    const draft = await makeNotice({ title: title('draft') });
    const future = await makeNotice({ title: title('future'), publish: true, publishAt: new Date(Date.now() + 86_400_000).toISOString() });
    const expired = await makeNotice({ title: title('expired'), publish: true, publishAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), expiresAt: new Date(Date.now() - 86_400_000).toISOString() });
    for (const n of [draft, future, expired]) {
      expect(await visibleTo('student@schoolone.com', n.id)).toBe(false);
      expect(await visibleTo('admin@schoolone.com', n.id)).toBe(true);
    }
  });

  it('publishing a draft via PATCH makes it visible; type filter works', async () => {
    const admin = await as('admin@schoolone.com');
    const n = await makeNotice({ title: title('later'), type: 'EVENT' });
    expect((await admin.patch(`/api/v1/notices/${n.id}`, { publish: true })).status).toBe(200);
    expect(await visibleTo('student@schoolone.com', n.id)).toBe(true);
    const events = await (await as('student@schoolone.com')).get('/api/v1/notices?type=EVENT&pageSize=100');
    expect(events.body.data.every((x: { type: string }) => x.type === 'EVENT')).toBe(true);
  });

  it('RBAC: students and teachers cannot create/update/delete', async () => {
    const n = await makeNotice({ title: title('rbac'), publish: true });
    for (const email of ['student@schoolone.com', 'teacher@schoolone.com']) {
      const u = await as(email);
      expect((await u.post('/api/v1/notices', { title: 'x', body: 'y' })).status).toBe(403);
      expect((await u.patch(`/api/v1/notices/${n.id}`, { title: 'z' })).status).toBe(403);
      expect((await u.del(`/api/v1/notices/${n.id}`)).status).toBe(403);
    }
  });

  it('tenant isolation: another school admin cannot read, edit or delete', async () => {
    const n = await makeNotice({ title: title('iso'), publish: true });
    const other = await as('admin@schooltwo.com');
    expect((await other.get(`/api/v1/notices/${n.id}`)).status).toBe(404);
    expect((await other.patch(`/api/v1/notices/${n.id}`, { title: 'hijack' })).status).toBe(404);
    expect((await other.del(`/api/v1/notices/${n.id}`)).status).toBe(404);
    const list = await other.get(`/api/v1/notices?pageSize=100&search=${started.getTime()}`);
    expect(list.body.data.length).toBe(0);
  });

  it('rejects targets pointing at another school class and invalid bodies', async () => {
    const admin = await as('admin@schoolone.com');
    const foreign = await prisma.class.findFirstOrThrow({ where: { school: { code: 'SCH-TWO' } } });
    expect((await admin.post('/api/v1/notices', { title: 'x', body: 'y', targets: [{ classId: foreign.id }] })).status).toBe(400);
    const bad = await admin.post('/api/v1/notices', { title: '' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('school admin can delete; super admin must specify a school when creating', async () => {
    const n = await makeNotice({ title: title('del') });
    expect((await (await as('admin@schoolone.com')).del(`/api/v1/notices/${n.id}`)).status).toBe(200);
    const sa = await as('superadmin@example.com');
    expect((await sa.post('/api/v1/notices', { title: 'x', body: 'y' })).status).toBe(400);
  });
});
