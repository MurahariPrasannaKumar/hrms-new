import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database';
import { bearer, tokenFor } from './helpers';

const app = createApp();
let student: string, teacher: string, admin: string;
let studentUserId: string;

beforeAll(async () => {
  const [s, t, a] = await Promise.all(['student@schoolone.com', 'teacher@schoolone.com', 'admin@schoolone.com'].map((e) => tokenFor(app, e)));
  student = s.token; teacher = t.token; admin = a.token; studentUserId = s.user.id;
  await prisma.usageDay.deleteMany({ where: { userId: studentUserId } });
});
afterAll(async () => {
  await prisma.usageDay.deleteMany({ where: { userId: studentUserId } });
  await prisma.$disconnect();
});

describe('usage tracking', () => {
  it('only students and teachers are tracked', async () => {
    expect((await request(app).get('/api/v1/usage/today').set(bearer(admin))).status).toBe(403);
    expect((await request(app).get('/api/v1/usage/today').set(bearer(teacher))).status).toBe(200);
  });

  it('credits reported seconds but never more than the real time elapsed', async () => {
    const first = await request(app).post('/api/v1/usage/heartbeat').set(bearer(student)).send({ seconds: 15 });
    expect(first.status).toBe(200);
    expect(first.body.data.seconds).toBeGreaterThan(0);

    // A burst of heartbeats cannot inflate the total: each call is capped by the seconds actually elapsed since the last.
    for (let i = 0; i < 5; i++) await request(app).post('/api/v1/usage/heartbeat').set(bearer(student)).send({ seconds: 60 });
    const today = await request(app).get('/api/v1/usage/today').set(bearer(student));
    expect(today.body.data.seconds).toBeLessThan(40);

    expect((await request(app).post('/api/v1/usage/heartbeat').set(bearer(student)).send({ seconds: 9999 })).status).toBe(400);
  });
});
