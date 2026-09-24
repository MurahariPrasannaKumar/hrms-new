import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let admin: string, teacher: string, student: string;
let teacherId: string, studentId: string;
let noticeId = '';
const TITLE = `Broadcast test ${Date.now()}`;

beforeAll(async () => {
  const [a, t, s] = await Promise.all(['admin@schoolone.com', 'teacher@schoolone.com', 'student@schoolone.com'].map((e) => tokenFor(app, e)));
  admin = a.token; teacher = t.token; student = s.token; teacherId = t.user.id; studentId = s.user.id;
});
afterAll(async () => {
  if (noticeId) await prisma.notice.deleteMany({ where: { id: noticeId } });
  await prisma.notification.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe('noticeboard broadcast', () => {
  it('only admins can post; teachers and students cannot', async () => {
    const body = { title: TITLE, body: 'Hello all', type: 'GENERAL', publish: true, targets: [] };
    expect((await request(app).post('/api/v1/notices').set(bearer(teacher)).send(body)).status).toBe(403);
    expect((await request(app).post('/api/v1/notices').set(bearer(student)).send(body)).status).toBe(403);
  });

  it('a published notice reaches teachers and students in the platform, with a link to the noticeboard', async () => {
    const res = await request(app).post('/api/v1/notices').set(bearer(admin)).send({ title: TITLE, body: 'Hello all', type: 'GENERAL', publish: true, targets: [] });
    expect(res.status).toBe(201);
    noticeId = res.body.data.id;
    for (const userId of [teacherId, studentId]) {
      await vi.waitFor(async () => {
        const n = await prisma.notification.findFirst({ where: { userId, title: TITLE } });
        expect(n).not.toBeNull();
        expect(n!.link).toBe('/notices');
        expect(n!.message).toContain('Hello all');
      });
    }
    const seen = await request(app).get('/api/v1/notices').set(bearer(student));
    expect(seen.body.data.some((n: { id: string }) => n.id === noticeId)).toBe(true);
  });
});
